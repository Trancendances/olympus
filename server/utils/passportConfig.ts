import * as passport from 'passport';
import * as passportLocal from 'passport-local';
import * as sequelize from 'sequelize';
import * as bcrypt from 'bcrypt';

import {SequelizeWrapper} from './sequelizeWrapper';

const LocalStrategy = passportLocal.Strategy;

export function passportConfig() {
	const User = SequelizeWrapper.getInstance().model('user');

	passport.serializeUser((user: any, done) => {
		done(null, user.username);
	});

	passport.deserializeUser((username, done) => {
		User.findOne({where: { username: username }, raw: true})
		.then((user: any) => {
			done(null, user);
		}).catch(done)
	});

	// Configure a local (username + password) strategy
	passport.use(new LocalStrategy((username, password, done) => {
		// Get user data
		User.findOne({where: { username: username }, raw: true})
		.then((user: any) => {
			if(!user) return done(null, false);
			// Compare the hash
			bcrypt.compare(password, user.passwordhash, (err, same) => {
				if(err) return done(err);

				if(same) return done(null, user)
				return done(null, false);
			});
		}).catch(done);
	}));
}