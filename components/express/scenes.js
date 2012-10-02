'use-strict'

var rootdir     = process.env.SCENE_STUDIO_ROOT;

var dbdir       = rootdir + '/components/database';

var dbwrite     = require(dbdir + '/dbwrite');
var queries     = require(dbdir + '/queries');
var dbwrapper   = require(dbdir + '/dbwrapper')();
    dbwrapper.mixin(dbwrite).mixin(queries);

var dbConstants = require(dbdir + '/constants');


function default_params() {
    return {
        title: 'SceneStudio',
        username: '',
    };
};

var Validator = require('../../public/javascripts/shared/Validator');
function validateSceneName(scene_name) {
    if(typeof scene_name !== 'string') // must type correctly
        return false;
    if(scene_name.length <= 0)  // empty string disallowed
        return false;

    return Validator.sceneName(scene_name);
}




exports.scenes = function(req, res) {
    var db = dbwrapper.db(); //db.verbose = false;
    db.getUserSceneList(req.session.user_id, function(err, scene_list) {
        db.close();
        if(err) {
            console.log(err); // send a proper error response???
            scene_list = [];
        }
        
        console.log('displaying scenes');
        console.dir(scene_list);
        
        var params = default_params();
        params.username = req.session.username;
        params.scenes = scene_list;
        res.render('scenes', params);
    });
};

exports.newScene = function(req, res) {
    var scene_name  = req.body.scene_name;
    var user_name   = req.session.username;
    
    console.log('scene name raw: ' + scene_name);
    console.log('is valid? ' + validateSceneName(scene_name));
    if(!validateSceneName(scene_name)) {
        // in general, it is hard for the user to fire this branch
        // since there is a client-side form validator
        res.redirect('/scenes');
        // TODO: Any way to redirect to current page? more flexible then
        //   UPDATE: Looks like session variables are the way to do this
        return;
    }
    
    var db = dbwrapper.db(); //db.verbose = false;
    db.newScene({
        scene_name:     scene_name,
        user_name:      user_name,
        scene_json:     dbConstants.default_scene_json,
    }, function(err) {
        db.close();
        if(err) {
            console.dir(err);
            // TODO send a proper error response?
            //res.send(500, 'Failed to Create New Scene');
            res.redirect('/scenes');
        } else {
            res.redirect('/scenes/' + user_name + '/' + scene_name + '/edit');
        }
    });
}

exports.editScene = function(req, res) {
    var user_id         = req.session.user_id;
    var scene_user_name = req.params[0];
    var scene_name      = req.params[1];
    
    var db = dbwrapper.db(); //db.verbose = false;
    db.getScene(user_id, scene_name, function(err, scene) {
        console.dir(scene);
        db.close();
        if(err || !scene) {
            if(err) console.log(err);
            res.send('Could not find scenes/'
                     +scene_user_name+'/'+scene_name, 404);
        } else {
            var params = default_params();
            params.username = req.session.username;
            params.scene = scene;
            params.close_url = '/scenes/';
            res.render('editScene', params);
        }
    });
}

exports.saveScene = function(req, res) {
    var user_name           = req.session.username;
    var scene_user_name     = req.params[0];
    var scene_name          = req.params[1];
    var scene_json_file     = req.body.scene_file;
    
    console.log('saving scenes/' +
                scene_user_name + '/' + scene_name + ' ...');
    var db = dbwrapper.db(); //db.verbose = false;
    db.updateScene({
        user_name:          user_name,
        scene_name:         scene_name,
        scene_json:         scene_json_file,
        ui_log:             "{}", // empty for now...
    }, function(err) {
        if(err) {
            console.log(err);
            res.send(500);
        } else {
            res.send();
        }
    });
}

exports.loadScene = function(req, res) {
    var user_id             = req.session.user_id;
    var scene_user_name     = req.params[0];
    var scene_name          = req.params[1];
    
    var db = dbwrapper.db(); //db.verbose = false;
    db.getScene(user_id, scene_name, function(err, scene) {
        console.dir(scene);
        db.close();
        if(err || !scene) {
            if(err) console.log(err);
            res.send(404);
        } else {
            var json_file = scene.json_data;
            res.send(json_file);
        }
    });
}
