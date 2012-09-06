
function default_params() {
    return {
        title: 'SceneStudio',
        username: '',
    };
};


var dummy_scene_list = {
    012: { name: 'The Living Room' },
    345: { name: 'Orc Barracks' },
    678: { name: 'Restaurant Franchise Idea' },
};

function getNewSceneID() {
    var new_id = Math.floor(Math.random() * 1000);
    while(new_id in dummy_scene_list)
        new_id = Math.floor(Math.random() * 1000);
    return new_id;
}

function getSceneNamed(scene_name) {
    for (var key in dummy_scene_list) {
        var scene = dummy_scene_list[key];
        if(scene.name == scene_name)
            return scene;
    }
    return undefined;
}

// TODO: Also validate on user side
function validateSceneName(scene_name) {
    if(typeof scene_name !== 'string') // must type correctly
        return false;
    if(scene_name.length <= 0)  // empty string disallowed
        return false;
    // TODO: Need to decide on a good way to do this
    // white/blacklist characters or whole strings here
    return true;
}

function createNewScene(scene_name) {
    var id = getNewSceneID();
    dummy_scene_list[id] = {
        name: scene_name,
    };
}

function saveScene(scene_name, scene_data) {
    var scene = getSceneNamed(scene_name);
    scene.data = scene_data;
    console.log(scene.data);
}



exports.scenes = function(req, res) {
    var params = default_params();
    params.username = req.session.username;
    params.scenes = dummy_scene_list;
    res.render('scenes', params);
};

exports.newScene = function(req, res) {
    var scene_name = req.body.scene_name;
    console.log('scene name raw: ' + scene_name);
    console.log('is valid? ' + validateSceneName(scene_name));
    if(!validateSceneName(scene_name)) {
        // TODO: Display Error to the User
        res.redirect('/scenes');
        // TODO: Any way to redirect to current page? more flexible then
        //   UPDATE: Looks like session variables are the way to do this
    } else {
        createNewScene(scene_name);
        // Assuming we are successful, then show the new scene
        res.redirect('/scenes/' + scene_name + '/edit');
    }
}

exports.editScene = function(req, res) {
    var scene_name = req.params.scene_name;
    var scene = getSceneNamed(scene_name);
    console.log(scene);
    if(scene === undefined) {
        res.send('Could not find scenes/'+scene_name, 404);
    } else {
        var params = default_params();
        params.username = req.session.username;
        params.scene = scene;
        params.close_url = '/scenes/';
        res.render('editScene', params);
    }
}

exports.saveScene = function(req, res) {
    var scene_name = req.params.scene_name;
    var scene_file = req.body.scene_file;
    console.log('saving ... \n' + scene_name);
    console.log('data type:\n' + (typeof scene_file));
    saveScene(scene_name, scene_file);
    res.send();
}

exports.loadScene = function(req, res) {
    var scene_name = req.params.scene_name;
    var scene = getSceneNamed(scene_name);
    if(scene.data) {
        var json_file = scene.data;
        res.send(json_file);
    } else {
        res.send(404); // signal no scene data with a 404 error right now
    }
}
