'use-strict'

var default_scene_room = {
    index:              -1,
    modelID:            'room',
    parentIndex:        -1,
    renderStateArr:     [true,false,false,false],
    cu:                 [1,0,0],
    cv:                 [0,1,0],
    cw:                 [0,0,1],
    parentMeshI:        -1,
    parentTriI:         -1,
    parentUV:           [0,0],
    cubeFace:           0,
    scale:              1,
    rotation:           0
};

var default_scene = [ JSON.stringify(default_scene_room) ];

exports.default_scene_json = JSON.stringify(default_scene);
