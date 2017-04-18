import {PluginConnector, State, Role, AccessLevel} from '../lib/plugins';
import {SequelizeWrapper} from '../utils/sequelizeWrapper';
import {handleErr} from '../utils/handleErrors';
import * as e from 'express';
import * as s from 'sequelize';

const username = 'brendan'; // TEMPORARY

// Set home
module.exports.home = function(req: e.Request, res: e.Response) {
	// Action only possible for admin users
	isAdmin(username, (err, admin) => {
		if(err) return handleErr(err, res);
		if(admin) {
			// Change the home plugin according to the user input
			PluginConnector.getInstance(req.body.plugin, (err, connector) => {
				if(err) return handleErr(err, res);
				// Check if connector is here, cause else TS will complain at compilation
				if(!connector) return handleErr(new Error('CONNECTOR_MISSING'), res);

				connector.setHome(req.body.disableOld, (err) => {
					if(err) return handleErr(err, res);
					res.sendStatus(200);
				});
			});
		} else {
			// Not admin, sorry :-(
			return handleErr(new Error('NOT_ADMIN'), res);
		}
	});
}

// Change plugin state
module.exports.changeState = function(req: e.Request, res: e.Response) {
	// Action only possible for admin users
	isAdmin(username, (err, admin) => {
		if(err) return handleErr(err, res);
		if(admin) {
			// Change the home plugin according to the user input
			PluginConnector.getInstance(req.body.plugin, (err, connector) => {
				if(err) return handleErr(err, res);
				// Check if connector is here, cause else TS will complain at compilation
				if(!connector) return handleErr(new Error('CONNECTOR_MISSING'), res);

				connector.setState(req.body.state, (err) => {
					if(err) return handleErr(err, res);
					res.sendStatus(200);
				});
			});
		} else {
			// Not admin, sorry :-(
			return handleErr(new Error('NOT_ADMIN'), res);
		}
	});
}

// Set access level on a plugin for a given user
module.exports.setAccessLevel = function(req: e.Request, res: e.Response) {
	// Action only possible for admin users
	isAdmin(username, (err, admin) => {
		if(err) return handleErr(err, res);
		if(admin) {
			// Change the home plugin according to the user input
			PluginConnector.getInstance(req.body.plugin, (err, connector) => {
				if(err) return handleErr(err, res);
				// Check if connector is here, cause else TS will complain at compilation
				if(!connector) return handleErr(new Error('CONNECTOR_MISSING'), res);

				let level = AccessLevel[<string>req.body.level];
				connector.setAccessLevel(req.body.username, level, (err) => {
					if(err) return handleErr(err, res);
					res.sendStatus(200);
				});
			});
		} else {
			// Not admin, sorry :-(
			return handleErr(new Error('NOT_ADMIN'), res);
		}
	});
}

module.exports.useradd = function(req: e.Request, res: e.Response) {}

module.exports.userdel = function(req: e.Request, res: e.Response) {}

// Check if a given user has the admin role
export function isAdmin(username: string, next:(err: Error | null, admin?: boolean) => void) {
	let wrapper = SequelizeWrapper.getInstance();
	// Fetch the user then compare its role to the admin one
	wrapper.model('user').findById(username).then((row: s.Instance<any>) => {
		next(null, Role[<string>row.get('role')] === Role.admin)
		return null;
	}).catch(next);
}