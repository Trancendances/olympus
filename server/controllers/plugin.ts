import * as Plugins from '../lib/plugins';
import * as express from 'express';
import {handleErr} from '../utils/handleErrors';
import {isAdmin} from './admin';

const username = 'brendan'; // TEMPORARY

module.exports.home = function(req: express.Request, res: express.Response, next) {
	Plugins.PluginConnector.getHomePluginName()
	.then((name) => res.status(200).send(name))
	.catch((err) => handleErr(err, res));;
}

module.exports.state = function(req: express.Request, res: express.Response, next) {
	Plugins.PluginConnector.getInstance(req.params.plugin)
	.then((connector) => {
		// Check if connector is here, cause else TS will complain at compilation
		if(!connector) throw new Error('CONNECTOR_MISSING');
		return connector.getState();
	}).then((state) => res.status(200).send(Plugins.State[<Plugins.State>state]))
	.catch((err) => handleErr(err, res));
}

module.exports.getList = function(req: express.Request, res: express.Response, next) {
	isAdmin(username)
	.then((admin) => {
		if(admin) {
			// If the user is admin, retrieve all plugins
			return Plugins.PluginConnector.getPlugins();
		} else {
			// If the user isn't admin, only retrieve enabled plugins
			return Plugins.PluginConnector.getPlugins(Plugins.State.enabled);
		}
	}).then((plugins) => res.status(200).send(plugins))
	.catch((err) => handleErr(err, res));
}