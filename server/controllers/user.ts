import * as s from 'sequelize';
import * as e from 'express';
import * as p from 'passport';
import * as bcrypt from 'bcrypt';
import * as Joi from 'joi';

import {SequelizeWrapper} from '../utils/sequelizeWrapper';
import {isAdmin} from './admin';
import {handleErr} from '../utils/handleErrors';

const username = 'brendan'; // TEMPORARY

const addSchema = Joi.object({
	username: Joi.string().required()
});

module.exports.auth = function(req: e.Request, res: e.Response, next: e.NextFunction) {
	// Authenticate the user with passport
	p.authenticate('local', (err, user, info) => {
		if(err) return handleErr(err, res);
		if(!user) return res.sendStatus(401);
		req.logIn(user, (err) => {
			if(err) return handleErr(err, res)
			return res.send(user);
		});
	})(req, res, next);
}

module.exports.get = function(req: e.Request, res: e.Response) {}

module.exports.add = function(req: e.Request, res: e.Response) {}

module.exports.update = function(req: e.Request, res: e.Response) {
	// Must be admin to update a user (or the user itself)
	if(!username.localeCompare(req.params.username)) {
		// Call update on the user model with the given username
		updateUser(req.params.user, req.body)
		.then(() => res.sendStatus(200))
		.catch((err) => handleErr(err, res));
	} else {
		isAdmin(username)
		.then((admin) => {
			if(!admin) throw new Error('NOT_ADMIN');
			// Call update on the user model with the given username
			return updateUser(req.params.user, req.body);
		}).then(() => res.sendStatus(200))
		.catch((err) => handleErr(err, res));
	}
}

module.exports.delete = function(req: e.Request, res: e.Response) {
	// Must be admin to remove a user (or the user itself)
	if(!username.localeCompare(req.params.username)) {
		// Call destroy on the user model with the given username
		updateUser(req.params.user, req.body)
		.then(() => res.sendStatus(200))
		.catch((err) => handleErr(err, res));
	} else {
		isAdmin(username)
		.then((admin) => {
			if(!admin) throw new Error('NOT_ADMIN');
			// Call destroy on the user model with the given username and the
			// given new data
			return updateUser(req.params.user, req.body);
		}).then(() => res.sendStatus(200))
		.catch((err) => handleErr(err, res));
	}
}

function updateUser(username: string, newData): Promise<null> {
	return new Promise<null>((resolve, reject) => {
		// Get the user to modify it afterwards
		SequelizeWrapper.getInstance().model('user').findById(username)
		.then(async (user: s.Instance<any>) => {
			if(!user) throw new Error('NOT_FOUND');
			// Set the new values accordingly with the new data
			if(newData.password) {
				let salt = await bcrypt.genSalt();
				let hash = await bcrypt.hash(newData.password, salt);
				user.set('salt', salt);
				user.set('passwordhash', hash);
			}
			if(newData.email) user.set('email', newData.email);
			if(newData.displayedname) user.set('displayedname', newData.displayedname);
			if(newData.role) user.set('role', newData.role);
			return user.save();
		}).then(() => resolve())
		.catch(reject);
	})
}

// Removes a given user from the database
function removeUser(username: string): Promise<null> {
	return new Promise<null>((resolve, reject) => {
		// Call destroy on the user model with the given username
		SequelizeWrapper.getInstance().model('user').destroy({
			where: { username: username }
		}).then(() => resolve())
		.catch(reject);
	})
}
