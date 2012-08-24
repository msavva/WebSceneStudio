
exports.gate = function(bounceDestination) {
    return function(req, res, next) {
        if(req.session.username === undefined)
            res.redirect(bounceDestination);
        else
            next();
    }
}

exports.bounceLoggedIn = function(bounceDestination) {
    return function(req, res, next) {
        if(req.session.username !== undefined)
            res.redirect(bounceDestination);
        else
            next();
    }
}

exports.login = function(req, res) {
    console.log('hit login w/ username=' + req.body.loginName);
    req.session.username = req.body.loginName;
    res.redirect('/');
};


exports.logout = function(req, res) {
    console.log('hit logout');
    delete req.session.username;
    res.redirect('/');
};
