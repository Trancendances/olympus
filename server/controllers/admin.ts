import {PluginConnector, State, Role, AccessLevel} from '../lib/plugins';
import {SequelizeWrapper} from '../utils/sequelizeWrapper';
import {handleErr} from '../utils/handleErrors';
import * as e from 'express';
import * as s from 'sequelize';

const username = 'brendan'; // TEMPORARY

// Set home
module.exports.home = function(req: e.Request, res: e.Response) {
	// Action only possible for admin users
	isAdmin(username)
	.then((admin) => {
		if(admin) {
			// Change the home plugin according to the user input
			return PluginConnector.getInstance(req.body.plugin)
		} else {
			// Not admin, sorry :-(
			throw new Error('NOT_ADMIN');
		}
	}).then((connector) => {
		// Check if connector is here, cause else TS will complain at compilation
		if(!connector) throw new Error('CONNECTOR_MISSING');

		return connector.setHome(req.body.disableOld)
	}).then(() => res.sendStatus(200)).catch((e) => handleErr(e, res));
}

// Change plugin state
module.exports.changeState = function(req: e.Request, res: e.Response) {
	// Action only possible for admin users
	isAdmin(username)
	.then((admin) => {
		if(admin) {
			// Change the home plugin according to the user input
			return PluginConnector.getInstance(req.body.plugin)
		} else {
			// Not admin, sorry :-(
			throw new Error('NOT_ADMIN');
		}
	}).then((connector) => {
		// Check if connector is here, cause else TS will complain at compilation
		if(!connector) throw new Error('CONNECTOR_MISSING');
		
		return connector.setState(req.body.state)
	}).then(() => res.sendStatus(200)).catch((e) => handleErr(e, res));
}

// Set access level on a plugin for a given user
module.exports.setAccessLevel = function(req: e.Request, res: e.Response) {
	// Action only possible for admin users
	isAdmin(username)
	.then((admin) => {		
		if(admin) {
			return PluginConnector.getInstance(req.body.plugin);
		} else {
			// Not admin, sorry :-(
			throw new Error('NOT_ADMIN');
		}
	}).then((connector) => {
		// Check if connector is here, cause else TS will complain at compilation
		if(!connector) throw new Error('CONNECTOR_MISSING');
		
		let level = AccessLevel[<string>req.body.level];
		return connector.setAccessLevel(req.body.username, level)
	}).then(() => res.sendStatus(200)).catch((e) => handleErr(e, res));
}

module.exports.useradd = function(req: e.Request, res: e.Response) {}

module.exports.userdel = function(req: e.Request, res: e.Response) {}

// Check if a given user has the admin role
export function isAdmin(username: string): Promise<boolean> {
	return new Promise<boolean>((reject, resolve) => {
		let wrapper = SequelizeWrapper.getInstance();
		// Fetch the user then compare its role to the admin one
		wrapper.model('user').findById(username)
		.then((row: s.Instance<any>) => {
			let admin: boolean = Role[<string>row.get('role')] === Role.admin;
			return resolve(admin)
		}).catch(reject);
	});
}