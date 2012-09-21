'use-strict'

var rootdir     = process.env.SCENE_STUDIO_ROOT;

var dbdir       = rootdir + '/components/database';

var dbwrite     = require(dbdir + '/dbwrite');
var queries     = require(dbdir + '/queries');
var dbwrapper   = require(dbdir + '/dbwrapper')();
    dbwrapper.mixin(dbwrite).mixin(queries);


// use to make sure we always have a username field defined
function ensureUsername(req) {
    if(!req.session.username)
        req.session.username = '';
}

exports.gate = function(bounceDestination) {
    return function(req, res, next) {
        ensureUsername(req);
        if(!req.session.username)
            res.redirect(bounceDestination);
        else
            next();
    }
}

exports.bounceLoggedIn = function(bounceDestination) {
    return function(req, res, next) {
        ensureUsername(req);
        if(req.session.username)
            res.redirect(bounceDestination);
        else
            next();
    }
}

exports.login = function(req, res) {
    var username = req.body.loginName;
    console.log('hit login w/ username=' + username);
    
    var db = dbwrapper.db(); //db.verbose = false;
    db.getUser(username, function(err, user_row) {
        if(err) console.log(err);
        if(err || !user_row) {
            req.session.username = '';
            // TODO: run a validator on the supplied user name
            // TODO: send a proper failed login message...
            // On failed login bounce to sign-up page?
        } else {
            req.session.username = username;
            req.session.user_id = user_row.id;
        }
        res.redirect('/');
    });
};


exports.logout = function(req, res) {
    console.log('hit logout');
    req.session.username = '';
    delete req.session.user_id;
    res.redirect('/');
};
