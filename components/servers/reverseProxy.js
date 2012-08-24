'use strict';

var http = require('http'),
    url = require('url'),
    httpProxy = require('http-proxy');

// WARNING:
// The router paths are checked in the order they are specified,
// so make sure to list them in MOST specific to LEAST specific order.
var options = {
    router: {
        // redirect traffic to the solr server
		'localhost/solr/': '127.0.0.1:8983/solr/',
        'localhost/architectureGenerator/': '127.0.0.1:3972/',
         // Direct all other traffic to the express application
        'localhost': '127.0.0.1:3000',
    }
};

function start() {
    httpProxy.createServer(options).listen(8000);
}

// Alternately, you can use the following proxy setup
/*
httpProxy.createServer(function(request, response, proxy) {
    // any custom logic we want here!
    proxy.proxyRequest(request, response, {
        host: 'localhost',
        port: 9000,
    });
}).listen(8000);
*/

exports.start = start;

