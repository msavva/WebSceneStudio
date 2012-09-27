

// this module is designed to be mixed into dbwrapper
// which can be accomplished as
//
// var dbwrite = require('dbwrite');
// var dbwrapper = require('dbwrapper');
//     dbwrapper.mixin(dbwrite);
// 
// Then all of the functions defined here will be available
// from any dbwrapper.db() created object

var async = require("async");


// passes the new user's id # onto the continuation
exports.newUser = function(username, callback)
{
    this.insertRow('USER', {
        name: username,
    },
    callback);
}

// passes the new model's id # onto the continuation
// WARNING: this function does not ensure the validity of
//          either the filename or the provided user id # foreign key
exports.newModel = function(filename, owner_id, callback)
{
    this.insertRow('MODEL', {
        filename: filename,
        owner: owner_id,
    },
    callback);
}

// see above warning
exports.newModels = function(filenames, owner_id, callback)
{
    var records = filenames.map(function(filename) {
        return { filename: filename, owner: owner_id };
    });
    this.insertRows('MODEL', records, callback);
}

// passes the new texture's id # onto the continuation
// WARNING: this function does not ensure the validity of
//          either the filename or the provided user id # foreign key
exports.newTexture = function(filename, owner_id, callback)
{
    this.insertRow('TEXTURE', {
        filename: filename,
        owner: owner_id,
    },
    callback);
}

// see above warning
exports.newTextures = function(filenames, owner_id, callback)
{
    var records = filenames.map(function(filename) {
        return { filename: filename, owner: owner_id };
    });
    this.insertRows('TEXTURE', records, callback);
}

exports.newScene = function(
    params, // see below
    callback
) {
    if(!params.scene_name ||
       !params.user_name ||
       !params.scene_json)
    {
        callback(new Error(
            'Did not supply all required parameters to newScene()\n'+
            'Need:      - scene_name\n'+
            '           - user_name\n'+
            '           - scene_json'));
        return;
    }
    var user_id = null;
    var scene_id = null;
    var scene_version_id = null;
    
    // PLAN:
    //  -   get user id
    //  -   check if this scene is a duplicate
    //  -   create a new SCENE
    //  -   create a new SCENE_VERSION
    //  -   point the SCENE at the VERSION
    
    this.transactionSequence([
    async.apply(this.getUser.bind(this), params.user_name),
    function(user_row, continueWaterfall) {
        if(!user_row) {
            continueWaterfall(new Error('could not find user ' +
                                        params.user_name));
            return;
        }
        user_id = user_row.id;
        this.getScene(user_id, params.scene_name, continueWaterfall);
    }.bind(this),
    function(scene, continueWaterfall) {
        if(scene) {
            continueWaterfall(new Error(
                'User ' + params.user_name + ' already has a scene'+
                ' named ' + params.scene_name));
            return;
        }
        this.insertRow('SCENE', {
            name:               params.scene_name,
            owner:              user_id,
            curr_version:       0, // place-holder
            // forked_from omitted intentionally
        }, continueWaterfall);
    }.bind(this),
    function(insert_scene_id, continueWaterfall) {
        scene_id = insert_scene_id;
        this.insertRow('SCENE_VERSION', {
            // previous_version intentionally omitted
            scene_writer:   scene_id,
            json:           params.scene_json,
            ui_log:         "", // empty log for first entry
        }, continueWaterfall);
    }.bind(this),
    function(insert_scene_version_id, continueWaterfall) {
        scene_version_id = insert_scene_version_id;
        this.updateRow('SCENE',
            { id:           scene_id }, // select
            { curr_version: scene_version_id }, // update
        continueWaterfall);
    }.bind(this)
    ], callback);
};

exports.forkScene = function(
    params,
    callback
) {
    if(!params.original_user_name ||
       !params.original_scene_name ||
       !params.scene_name ||
       !params.user_name)
    {
        callback(new Error(
            'Did not supply all required parameters to forkScene()\n'+
            'Need:      - original_user_name\n'+
            '           - original_scene_name\n'+
            '           - user_name\n'+
            '           - scene_name'));
        return;
    }
    
    var original_user_id = null;
    var original_scene_id = null;
    var original_scene_version_id = null;
    var original_json = null;
    
    var user_id = null;
    var scene_id = null;
    var scene_version_id = null;
    
    // PLAN:
    //  -   get user ids
    //  -   check if the new scene is a duplicate
    //  -   get the original scene's data
    //  -   create a new SCENE
    //  -   create a new SCENE_VERSION
    //  -   point the new SCENE at the VERSION
    
    this.transactionSequence([
    async.apply(async.parallel, {               // GET the requested USER's ids
        orig: async.apply(this.getUser.bind(this), params.original_user_name),
        copy: async.apply(this.getUser.bind(this), params.user_name),
    }),
    function(user_rows, continueWaterfall) {
        if(!user_rows.orig || !user_rows.copy) {
            var err = 'could not find user(s)' +
                      ((user_rows.orig)? '' : params.original_user_name) +
                      ((user_rows.copy)? '' : params.user_name);
            continueWaterfall(new Error(err));
            return;
        }
        
        original_user_id    = user_rows.orig.id;
        user_id             = user_rows.copy.id;
        console.dir([original_user_id, user_id]);
        
        async.parallel({                        // GET the requested SCENEs
            orig: async.apply(this.getScene.bind(this),
                                original_user_id, params.original_scene_name),
            copy: async.apply(this.getScene.bind(this),
                                user_id, params.scene_name),
        }, continueWaterfall);
    }.bind(this),
    function(scene_rows, continueWaterfall) {
        if(scene_rows.copy || !scene_rows.orig) {
            console.dir(scene_rows);
            var err = (scene_rows.copy)?
                ('User ' + params.user_name + ' already has a scene '+
                'named ' + params.scene_name) :
                ('User ' + params.original_user_name + ' does not have '+
                'a scene named ' + params.original_scene_name);
            continueWaterfall(new Error(err));
            return;
        }
        
        original_scene_id           = scene_rows.orig.scene_id;
        original_scene_version_id   = scene_rows.orig.current_version;
        original_json               = scene_rows.orig.json_data;
        
        this.insertRow('SCENE', {               // INSERT SCENE
            name:                   params.scene_name,
            owner:                  user_id,
            curr_version:           0, // place-holder
            forked_from:            original_scene_id,
        }, continueWaterfall);
    }.bind(this),
    function(insert_scene_id, continueWaterfall) {
        scene_id = insert_scene_id;
        this.insertRow('SCENE_VERSION', {
            previous_version:   original_scene_version_id,
            scene_writer:       scene_id,
            json:               original_json,
            ui_log:             "", // no UI involved in creating fork
        }, continueWaterfall);
    }.bind(this),
    function(insert_scene_version_id, continueWaterfall) {
        scene_version_id = insert_scene_version_id;
        this.updateRow('SCENE',
            { id:               scene_id }, // select
            { curr_version:     scene_version_id }, // update
        continueWaterfall);
    }.bind(this)
    ], callback);
};

exports.updateScene = function(
    params,
    callback
) {
    if(!params.scene_name ||
       !params.user_name ||
       !params.scene_json ||
       !params.ui_log)
    {
        callback(new Error(
            'Did not supply all required parameters to updateScene()\n'+
            'Need:      - user_name\n'+
            '           - scene_name\n'+
            '           - scene_json\n'+
            '           - ui_log'));
        return;
    }
    
    var user_id = null;
    var scene_id = null;
    var scene_version_id = null;
    var prev_version_id = null;
    
    this.transactionSequence([
    async.apply(this.getUser.bind(this), params.user_name),
    function(user_row, continueWaterfall) {
        if(!user_row) {
            continueWaterfall(new Error('could not find user ' +
                                        params.user_name));
            return;
        }
        
        user_id = user_row.id;
        
        this.getScene(user_id, params.scene_name, continueWaterfall);
    }.bind(this),
    function(scene, continueWaterfall) {
        if(!scene) {
            continueWaterfall(new Error(
                'User ' + params.user_name + ' does not have a scene'+
                ' named ' + params.scene_name));
            return;
        }
        
        scene_id            = scene.scene_id;
        prev_version_id     = scene.current_version;
        
        this.insertRow('SCENE_VERSION', {
            previous_version:   prev_version_id,
            scene_writer:       scene_id,
            json:               params.scene_json,
            ui_log:             params.ui_log,
        }, continueWaterfall);
    }.bind(this),
    function(insert_scene_version_id, continueWaterfall) {
        scene_version_id = insert_scene_version_id;
        this.updateRow('SCENE',
            { id:           scene_id }, // select
            { curr_version: scene_version_id }, // update
        continueWaterfall);
    }.bind(this)
    ], callback);
};

// delete items, change privacy







