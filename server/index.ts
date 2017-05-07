import * as Hapi from 'hapi';

import {loadRoutes} from './utils/routesLoader';
import {loadPlugins} from './utils/pluginsLoader';

const pkg = require('../../package.json');
const log = require('printit')({
	date: true,
	prefix: 'Olympus'
});

const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || 1708;

let debug: any;
if(process.env.DEBUG) {
	debug = {
		log: ['error'],
		request: ['error']
	}; 
}

const server = new Hapi.Server({ 
	debug: debug,
	connections: <Hapi.IConnectionConfigurationServerDefaults>{
		routes: { cors: {
			origin: ['*'], // Temporary
			credentials: true
		}}
	}
} as Hapi.IServerOptions);

server.connection({ port: port, host: host });

server.register([
	require('inert'),
	require('vision'),
	{
		register: require('hapi-swagger'),
		options: { info: {
			'title': pkg.name,
			'description': pkg.description,
			'version': pkg.version,
		}}
	}
], (err) => {
	if(err) {
		log.error(err);
		process.exit(1);
	}

	// Serve the client
	server.route({
		method: 'GET',
		path: '/{file*}',
		handler: { directory: {
			path: __dirname + '/../client/',
			listing: true
		}}
	});

	// Load the routes from the main router
	loadRoutes(server);
	// Load the install plugins
	loadPlugins(server);
});

// Start the server
server.start((err) => {
	if(err) {
		log.error(err);
		process.exit(1);
	}
	
	log.info('Server running at', server.info.uri);
});