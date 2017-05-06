"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const passport = require("passport");
const passportLocal = require("passport-local");
const bcrypt = require("bcrypt");
const sequelizeWrapper_1 = require("./sequelizeWrapper");
const LocalStrategy = passportLocal.Strategy;
function passportConfig() {
    const User = sequelizeWrapper_1.SequelizeWrapper.getInstance().model('user');
    passport.serializeUser((user, done) => {
        done(null, user.username);
    });
    passport.deserializeUser((username, done) => {
        User.findOne({ where: { username: username }, raw: true })
            .then((user) => {
            done(null, user);
        }).catch(done);
    });
    // Configure a local (username + password) strategy
    passport.use(new LocalStrategy((username, password, done) => {
        // Get user data
        User.findOne({ where: { username: username }, raw: true })
            .then((user) => {
            if (!user)
                return done(null, false);
            // Compare the hash
            bcrypt.compare(password, user.passwordhash, (err, same) => {
                if (err)
                    return done(err);
                if (same)
                    return done(null, user);
                return done(null, false);
            });
        }).catch(done);
    }));
}
exports.passportConfig = passportConfig;
