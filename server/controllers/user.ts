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
		// Call destroy on the user model with the given username
		removeUser(req.params, (err) => {
			if(err) return handleErr(err, res);
			res.sendStatus(200);
		});
	} else {
		isAdmin(username, (err, admin) => {
			if(err) return handleErr(err, res);
			if(!admin) return handleErr(new Error('NOT_ADMIN'), res);
			// Call destroy on the user model with the given username
			updateUser(req.params.user, req.body, (err) => {
				if(err) return handleErr(err, res);
				res.sendStatus(200);
			})
		});
	}
}

module.exports.delete = function(req: e.Request, res: e.Response) {
	// Must be admin to remove a user (or the user itself)
	if(!username.localeCompare(req.params.username)) {
		// Call destroy on the user model with the given username
		removeUser(req.params.username, (err) => {
			if(err) return handleErr(err, res);
			res.sendStatus(200);
		});
	} else {
		isAdmin(username, (err, admin) => {
			if(err) return handleErr(err, res);
			if(!admin) return handleErr(new Error('NOT_ADMIN'), res);
			// Call destroy on the user model with the given username
			removeUser(req.params.user, (err) => {
				if(err) return handleErr(err, res);
				res.sendStatus(200);
			})
		});
	}
}

function updateUser(username: string, newData, next:(err: Error | null) => void): void {
	// Get the user to modify it afterwards
	SequelizeWrapper.getInstance().model('user').findById(username)
	.then(async (user: s.Instance<any>) => {
		if(!user) return next(new Error('NOT_FOUND'))
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
		user.save().then((user) => {
			console.log(user.get())
			next(null);
			return null;
		}).catch(next);
		return null;
	});
}

// Removes a given user from the database
function removeUser(username: string, next:(err: Error | null) => void): void {
	// Call destroy on the user model with the given username
	SequelizeWrapper.getInstance().model('user').destroy({
		where: { username: username }
	}).then(() => {
		next(null);
		return null;
	}).catch((err) => {
		next(err);
		return null;
	});
}
