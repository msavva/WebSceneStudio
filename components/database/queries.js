'use-strict';


// this module is designed to be mixed into dbwrapper
// which can be accomplished as
//
// var queries = require('queries');
// var dbwrapper = require('dbwrapper');
//     dbwrapper.mixin(queries);
// 
// Then all of the functions defined here will be available
// from any dbwrapper.db() created object

//var async = require("async");



exports.getUser = function(username, callback)
{
    this.execute("SELECT * from USER where name = ?", [username],
      function(err, res) {
        if(err) { callback(err); return; } // report errors
        
        if(res.rows.length == 1) {
            callback(null, res.rows[0]);
        } else if(res.rows.length == 0) { // nothing found
            callback(null, null); // return null instead of a row
        } else { // IMPOSSIBLE under unique constraint
            callback(new Error('Somehow found more than one row for user '
                                + username + ' in the database.'), null);
        }
    });
}

exports.getScene = function(user_id, scenename, callback)
{
    this.execute('SELECT * from CURRENT_SCENE where '+
                    'owner = ? AND name = ?', [user_id, scenename],
      function(err, res) {
        if(err) { callback(err); return; }
        
        if(res.rows.length == 1) {
            callback(null, res.rows[0]);
        } else if(res.rows.length == 0) { // no such scene
            callback(null, null);
        } else {
            callback(new Error('Somehow found more than one '+
                'current_scene row for user_id/scene_name ' +
                user_id + '/' + scenename));
        }
    });
}

exports.getUserSceneList = function(user_id, callback) {
    this.execute(
    'SELECT '+
    '   SCN.scene_id AS id, '+
    '   SCN.name AS scene_name, '+
    '   SCN.owner AS user_id, '+
    '   SCN.date_updated AS date_updated, '+
    '   FORK.name AS forked_scene_name, '+
    '   FORK.owner AS forked_user_id '+ // get the other user name?
    'from CURRENT_SCENE as SCN left join CURRENT_SCENE as FORK '+
    '   on SCN.forked_from = FORK.scene_id '+
    'where SCN.owner = ?',
    [user_id], function(err, res) {
        if(err) { callback(err); return; }
        
        callback(null, res.rows);
    });
}




