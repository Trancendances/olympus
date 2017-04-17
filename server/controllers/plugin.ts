import * as p from '../lib/plugins';
import * as e from 'express';
import {handleErr} from '../utils/handleErrors';
import {isAdmin} from './admin';

const username = 'brendan'; // TEMPORARY

module.exports.home = function(req: e.Request, res: e.Response, next) {
	p.PluginConnector.getHomePluginName((err, name) => {
		if(err) return handleErr(err, res);
		res.status(200).send(name);
	});
}

module.exports.state = function(req: e.Request, res: e.Response, next) {
	p.PluginConnector.getInstance(req.params.plugin, (err, connector) => {
		if(err) return handleErr(err, res);
		// Check if connector is here, cause else TS will complain at compilation
		if(!connector) return handleErr(new Error('CONNECTOR_MISSING'), res);
		connector.getState((err, state) => {
			if(err) return handleErr(err, res);
			res.status(200).send(p.State[<p.State>state]);
		});
	});
}

module.exports.getList = function(req: e.Request, res: e.Response, next) {
	isAdmin(username, (err, admin) => {
		if(err) return handleErr(err, res);
		if(admin) {
			// If the user is admin, retrieve all plugins
			p.PluginConnector.getPlugins(null, (err, plugins) => {
				res.status(200).send(plugins);
			});
		} else {
			// If the user isn't admin, only retrieve enabled plugins
			p.PluginConnector.getPlugins(p.State.enabled, (err, plugins) => {
				res.status(200).send(plugins);
			});
		}
	});
}