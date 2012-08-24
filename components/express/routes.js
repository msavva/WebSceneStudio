
/*
 * GET home page.
 */
 
function default_params() {
    return {
        title: 'SceneStudio',
        username: '',
    };
};

exports.welcome = function(req, res){
    var params = default_params();
    res.render('index', params);
};

exports.main = function(req, res) {
    var params = default_params();
    params.username = req.session.username;
    res.render('main', params);
};

