"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Hapi = require("hapi");
const pkg = require('../../package.json');
const log = require('printit')({
    date: true,
    prefix: 'Olympus'
});
const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 1708;
let debug;
if (process.env.DEBUG) {
    debug = {
        log: ['error'],
        request: ['error']
    };
}
const server = new Hapi.Server({
    debug: debug,
    connections: {
        routes: { cors: {
                origin: ['*'],
                credentials: true
            } }
    }
});
server.connection({ port: port, host: host });
server.register([
    require('inert'),
    {
        register: require('hapi-swagger'),
        options: {
            info: {
                'title': pkg.name,
                'description': pkg.description,
                'version': pkg.version,
            },
        }
    },
    require('vision')
], (err) => {
    if (err) {
        log.error(err);
        process.exit(1);
    }
    // Serve the client
    server.route({
        method: 'GET',
        path: '/{file*}',
        handler: {
            directory: {
                path: __dirname + '/../client/',
                listing: true
            }
        }
    });
    // Load the routes from the main router
    //loader.loadRoutes(server);
});
// Start the server
server.start((err) => {
    if (err) {
        log.error(err);
        process.exit(1);
    }
    log.info('Server running at', server.info.uri);
});
