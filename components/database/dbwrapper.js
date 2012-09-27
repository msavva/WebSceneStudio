'use-strict';
var rootdir     = process.env.SCENE_STUDIO_ROOT;

/*
    dbwrapper exposes a javascript-y interface to the database
        via (mostly) schema-independent functions.
    
    e.g. table creation/modification/deletion,
         row insertion/deletion, etc.
    
    extra functionality can be mixed in, but all DDL should
        probably be handled here
    
    NOTE: there is a verbose variable which can be set in order
            to better examine the contents of the communication stream
            to and from the database server.
 */

var async   = require('async');
var mysql   = require('mysql-native');
var fs      = require('fs');

var options_filename = rootdir + "/options.json";
var options = JSON.parse(fs.readFileSync(options_filename, 'utf-8'));

function duckLike(parentObj) {
    function F() {}
    F.prototype = parentObj;
    return new F();
}

var DBPrototype = duckLike(Object);

// not provided as member function to prevent
// superfluous (and potentially destructive)
// calls to the function after initialization
function initDB(db_obj) {
    db_obj.sql_driver = mysql.createTCPClient(); // localhost:3306 by default
    db_obj.sql_driver.auto_prepare = true;
    db_obj.sql_driver.auth(options.db_login.database,
                           options.db_login.user,
                           options.db_login.password);
}

module.exports = function(optional_mixins) {
    var mixedPrototype = duckLike(DBPrototype);
    var result = {
        db: function() {
            var newDB = duckLike(mixedPrototype);
            initDB(newDB);
            newDB.verbose = false;
            return newDB;
        },
        mixin: function(method_mixin) {
            for(var method_name in method_mixin)
                mixedPrototype[method_name] = method_mixin[method_name];
            return result;
        },
    };
    if(optional_mixins)
        result.mixin(optional_mixins);
    return result;
};

// make sure to call this function when you're done...
DBPrototype.close = function() {
    this.sql_driver.close();
}

// wrap up the mysql-native library to export a proper async callback interface
DBPrototype.execute = function(command, values, callback) {
    var obj;
    // multi-plex on whether a prepared statement is necessary
    if(values)
        obj = this.sql_driver.execute(command, values);
    else
        obj = this.sql_driver.query(command);
    obj.addListener("result",
      function(response) {
        if(this.verbose) {
            console.log('sent MYSQL command');
            console.log(command);
            console.log('with values');
            console.dir(values);
            console.log('and got the following response');
            console.dir(response);
        }
        callback(null, response);
    }.bind(this)).addListener("error",
      function(error) {
        console.log('MYSQL command failed:');
        console.log(command);
        console.log('with values');
        console.dir(values);
        callback(new Error(error), null);
    });
}

DBPrototype.startTransaction = function(callback) {
    this.execute('START TRANSACTION', null,
                 function(err, res) { callback(err); } );
}

DBPrototype.commit = function(callback) {
    this.execute('COMMIT', null,
                 function(err, res) { callback(err); } );
}

DBPrototype.rollback = function(callback) {
    this.execute('ROLLBACK', null,
                 function(err, res) { callback(err); } );
}


// boilerplate for a transaction structured with
// async's waterfall.  Handles finalization, commit, rollback and errors.
DBPrototype.transactionSequence = function(waterfall, callback)
{
    /*var runWaterfall = function(call) {
        try {
            async.waterfall(waterfall, call);
        } catch(err) {
            call(err);
        }
    }*/
    
    async.series([
        this.startTransaction.bind(this),
        async.apply(async.waterfall, waterfall),
        this.commit.bind(this),
    ], function(err) {
        if(err) {
            this.rollback(function(rollbackError) {
                if(rollbackError) { // error rolling back...
                    console.err('rollback FAILED.  Oh shit!');
                }
                callback(err);
            }.bind(this));
        } else {
            callback(null);
        }
    }.bind(this));
}





var dummyColumnSchema = { /* not a valid schema... */
    name: 'column name here',
    type: 'column type here',
    nullable: true, /* treated as Boolean; defaults to false */
    autoIncrement: true, /* treated as Boolean; defaults to false */
    defaultVal: null, /* ignored if undefined */
    primaryKey: true, /* treated as Boolean; defaults to false */
    unique: true, /* treated as Boolean; defaults to false */
};

var dummyTableSchema = { /* not a valid schema? */
    name: 'table name here',
    columns: [
        dummyColumnSchema,
    ],
};



DBPrototype.createTable = function(table, callback) {
    var command = 'CREATE TABLE ' + table.name + ' ( ';
    for(var i=0; i<table.columns.length; i++) {
        var column = table.columns[i];
        
        if(i!=0) command += ', ';
        command += column.name + ' ' + column.type;
        // annotations after the type
        if(!column.primaryKey && !column.nullable)
            command += ' NOT NULL';
        if(column.autoIncrement)
            command += ' AUTO_INCREMENT';
        if(column.defaultVal !== undefined && column.defaultVal !== null)
            command += ' DEFAULT ' + column.defaultVal;
        
        // extra lines / constraints
        if(column.primaryKey)
            command += ', PRIMARY KEY (' + column.name + ')';
        else if (column.unique)
            command += ', UNIQUE (' + column.name + ')';
    }
    if(table.constraints) {
    for(var i=0; i<table.constraints.length; i++) {
        var constraint = table.constraints[i];
        
        switch(constraint.type) {
        case 'unique':
            command+= ', UNIQUE (';
            for(var c=0; c<constraint.columns.length; c++) {
                if(c != 0)  command += ', ';
                command += constraint.columns[c];
            }
            command+= ')';
            break;
        default: // ignore all else
            console.err('ignoring constraint: unrecognized type');
            console.err(JSON.stringify(constraint));
            break;
        }
    }}
    command += ' )';
    
    this.execute(command, null, 
                 function(err, res) { callback(err); } );
}

// takes the same kind of table schema object as createTable
DBPrototype.dropTable = function(table, callback) {
    var command = 'DROP TABLE ' + table.name;
    
    this.execute(command, null,
                 function(err, res) { callback(err); } );
}

DBPrototype.addColumn = function(tablename, column, callback) {
    if(column.primaryKey) {
        callback('Cannot add Primary Key Column to a Table');
        return;
    }
    
    var command = 'ALTER TABLE ' + tablename + ' ADD COLUMN ';
    
    command += column.name + ' ' + column.type;
    if(!column.nullable)
        command += ' NOT NULL';
    if(column.autoIncrement)
        command += ' AUTO_INCREMENT';
    if(column.defaultVal !== undefined && column.defaultVal !== null)
        command += ' DEFAULT ' + column.defaultVal;
    
    // extra lines / constraints
    if (column.unique)
        command += ', ADD UNIQUE (' + column.name + ')';
    
    this.execute(command, null,
                 function(err, res) { callback(err); } );
}

DBPrototype.dropColumn = function(tablename, column, callback) {
    var command = 'ALTER TABLE ' + tablename;
    command += ' DROP COLUMN ' + column.name;
    
    this.execute(command, null,
                 function(err, res) { callback(err); } );
}

/*
    rows should be encoded as
    {
        column_name: value,
        ...
    }
    
    When used to delete a row, all rows matching the partial
    description will be deleted.
 */
DBPrototype.insertRow = function(tablename, row, callback) {
    // unpack row data
    var col_names = [];
    var values = [];
    for(var columnname in row) {
        col_names.push(columnname);
        values.push(row[columnname]);
    }
    
    if(col_names.length <= 0) {
        callback('row has to contain something');
        return;
    }
    
    var command = 'INSERT INTO ' + tablename + ' ( ';
    for(var i=0; i<col_names.length; i++) {
        if(i!=0) command += ', ';
        command += col_names[i];
    }
    command += ' ) VALUES ( ';
    for(var i=0; i<values.length; i++) {
        if(i!=0) command += ', ';
        command += '?';
    }
    command += ' )';
    
    this.execute(command, values, function(err, res) {
        if(err)     callback(err, null)
        else        callback(null, res.insert_id);
    });
}

/*
    matchRow specifies a selection on a subset of rows that
        agree with matchRow's values
    updateRow specifies a subset of the columns and values which
        those columns should be updated to.  All other columns
        are left unchanged.
*/
DBPrototype.updateRow = function(
    tablename,
    selectRow,
    updateRow,
    callback
) {
    var numSelect = 0;
    var numUpdate = 0;
    var values = [];
    
    var command = 'UPDATE ' + tablename + ' SET ';
    for(var col_name in updateRow) {
        if(numUpdate != 0) command += ', '
        command += col_name + '=?';
        values.push(updateRow[col_name]);
        numUpdate += 1;
    }
    command += ' WHERE ';
    for(var col_name in selectRow) {
        if(numSelect != 0) command += ' AND '
        command += col_name + '=?';
        values.push(selectRow[col_name]);
        numSelect += 1;
    }
    
    if(numUpdate <= 0) {
        callback(new Error('trying to update without specifying any change'));
        return;
    }
    
    this.execute(command, values, function(err, res) {
        if(err)     callback(err);
        else        callback(null);
    });
}

DBPrototype.getRows = function(
    tablename,
    selectRow,
    callback
) {
    var numSelect = 0;
    var values = [];
    
    var command = 'SELECT * FROM ' + tablename + ' WHERE ';
    for(var col_name in selectRow) {
        if(numSelect != 0) command += ' AND '
        command += col_name + '=?';
        values.push(selectRow[col_name]);
        numSelect += 1;
    }
    
    this.execute(command, values, function(err, res) {
        if(err)     callback(err, null);
        else        callback(null, res.rows);
    });
}

DBPrototype.deleteRow = function(tablename, row, callback) {
    // unpack row data
    var col_names = [];
    var values = [];
    for(var columnname in row) {
        col_names.push(columnname);
        values.push(row[columnname]);
    }
    
    if(col_names.length <= 0) {
        callback('row has to contain something');
        return;
    }
    
    var command = 'DELETE FROM ' + tablename + ' WHERE ';
    for(var i=0; i<col_names.length; i++) {
        if(i!=0) command += ' AND ';
        command += col_names[i] + ' = ?';
    }
    
    this.execute(command, values,
                 function(err, res) { callback(err); } );
}




