
var async       = require('async');
var dbwrapper   = require(__dirname + '/../dbwrapper')();

var id_column = {
    name: 'id',
    type: 'int UNSIGNED',
    primaryKey: true,
    unique: true,
    autoIncrement: true,
};

var filename_column = {
    name: 'filename',
    type: 'varchar(255)', // should have more OS aware length?
    unique: true,
};

var owner_column = {
    name: 'owner',
    type: id_column.type, // foreign key pointing into USER table
};

var date_created_column = {
    name: 'date_created',
    type: 'timestamp',
    defaultVal: 'CURRENT_TIMESTAMP',
};

var deleted_column = {
    name: 'deleted',
    type: 'bool',
    defaultVal: 'FALSE'
};

var private_column = {
    name: 'private',
    type: 'bool',
    defaultVal: 'FALSE',
}

// Tables

var USER = {
    name: 'USER',
    columns: [
    id_column,
    { // user-name column
        name: 'name',
        type: 'varchar(50)',
        unique: true,
    },
    date_created_column,
    deleted_column
    ],
};

var MODEL = {
    name: 'MODEL',
    columns: [
    id_column,
    //{ // model-name column ... ? (get rid of?)
    //    name: 'name',
    //    type: 'tinytext', // right length?
    //},
    filename_column,
    owner_column,
    date_created_column,
    deleted_column,
    private_column,
    ],
};

var TEXTURE = {
    name: 'TEXTURE',
    columns: [
    id_column,
    filename_column,
    owner_column,
    date_created_column,
    deleted_column,
    private_column,
    ],
};

var SCENE_VERSION = {
    name: 'SCENE_VERSION',
    columns: [
    id_column,
    {
        name: 'previous_version',
        type: id_column.type, // "foreign key" pointing back into SCENE_VERSION
        nullable: true,
    },
    date_created_column,
    {
        name: 'scene_writer',
        type: id_column.type, // "foreign key" pointing into SCENE
    },
    {
        name: 'json',
        type: 'mediumtext',
    },
    {
        name: 'ui_log',
        type: 'mediumtext',
    },
    ],
};

var SCENE = {
    name: 'SCENE',
    columns: [
    id_column,
    { // scene-name column
        name: 'name',
        type: 'varchar(80)',
        // Should be UNIQUE when coupled with owner
    },
    owner_column,
    {
        name: 'curr_version',
        type: id_column.type, // "foreign key" pointing into SCENE_VERSION
    },
    {
        name: 'forked_from',
        type: id_column.type, // "foreign key" pointing back into SCENE
        nullable: true,
    },
    deleted_column,
    private_column,
    ],
    // --------------
    constraints: [
    {
        type: 'unique',
        columns: [ 'owner', 'name' ],
    },
    ],
};


exports.up = function(nextMigration){
    var db = dbwrapper.db();
    
    db.transactionSequence([
    async.apply(db.createTable.bind(db), USER),
    async.apply(db.createTable.bind(db), MODEL),
    async.apply(db.createTable.bind(db), TEXTURE),
    async.apply(db.createTable.bind(db), SCENE_VERSION),
    async.apply(db.createTable.bind(db), SCENE),
    function(callback) {
        db.execute('CREATE VIEW CURRENT_SCENE AS '+
         'SELECT SCN.id                   AS scene_id, '+
         '       SCN.curr_version         AS current_version, '+
         '       VER.previous_version     AS previous_version, '+
         '       SCN.forked_from          AS forked_from, '+
         '       SCN.owner                AS owner, '+
         '       SCN.name                 AS name, '+
         '       VER.date_created         AS date_updated, '+
         '       VER.json                 AS json_data, '+
         '       SCN.private              AS private, '+
         '       SCN.deleted              AS deleted '+
         'from SCENE as SCN inner join SCENE_VERSION as VER '+
         '    on SCN.curr_version = VER.id',
        null, function(err, res) { callback(err); });
    },
    ], function(err) { // finally clause
        db.close();
        if(err) { throw err; return; }
        nextMigration();
    });
};

exports.down = function(nextMigration){
    var db = dbwrapper.db();
    //db.verbose = true;
    
    db.transactionSequence([
    function(callback) {
        db.execute(
        'DROP VIEW CURRENT_SCENE',
        null, function(err, res) { callback(err); });
    },
    async.apply(db.dropTable.bind(db), USER),
    async.apply(db.dropTable.bind(db), MODEL),
    async.apply(db.dropTable.bind(db), TEXTURE),
    async.apply(db.dropTable.bind(db), SCENE_VERSION),
    async.apply(db.dropTable.bind(db), SCENE),
    ], function(err) {
        db.close();
        if(err) { throw err; return; }
        nextMigration();
    });
};

