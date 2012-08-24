
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./components/express/routes')
  , sceneRoutes = require('./components/express/scenes')
  , access = require('./components/express/accessControl')
  , http = require('http')
  , path = require('path');

var exec = require('child_process').exec
  , reverseProxy = require('./components/servers/reverseProxy');

// Boot up the reverse proxy
reverseProxy.start();

// Boot up the solr server
var solrProc = exec("python StartServer.py",
                    { cwd: './components/servers/solr'});
solrProc.stdout.pipe(process.stdout, {end: false});

// Now, let's define the Express application...
var app = express();


app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/components/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
  // TODO: Figure out how to configure for deployment as well as
  //        for development.
});


// Home/Login/Logout
app.get('/', access.gate('/welcome'), routes.main);
app.get('/welcome', access.bounceLoggedIn('/'), routes.welcome);
app.post('/login', access.login);
app.get('/logout', access.logout);

// Scene List
app.get('/scenes', access.gate('/welcome'), sceneRoutes.scenes);
app.post('/newScene', access.gate('/welcome'), sceneRoutes.newScene);
app.get('/scenes/:scene_name/edit', access.gate('/welcome'),
                                    sceneRoutes.editScene);

// 404 error route
// THIS IS A STUB.  Need a proper 404 response page.
app.use(function(req, res, next) { res.send('a 404 message, hey?', 404); });

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
