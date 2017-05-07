"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const p = require("passport");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const sequelizeWrapper_1 = require("../utils/sequelizeWrapper");
const admin_1 = require("./admin");
const handleErrors_1 = require("../utils/handleErrors");
const username = 'brendan'; // TEMPORARY
const addSchema = Joi.object({
    username: Joi.string().required()
});
module.exports.auth = function (req, res, next) {
    // Authenticate the user with passport
    p.authenticate('local', (err, user, info) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        if (!user)
            return res.sendStatus(401);
        req.logIn(user, (err) => {
            if (err)
                return handleErrors_1.handleErr(err, res);
            return res.send(user);
        });
    })(req, res, next);
};
module.exports.get = function (req, res) { };
module.exports.add = function (req, res) { };
module.exports.update = function (req, res) {
    // Must be admin to update a user (or the user itself)
    if (!username.localeCompare(req.params.username)) {
        // Call update on the user model with the given username
        updateUser(req.params.user, req.body)
            .then(() => res.sendStatus(200))
            .catch((err) => handleErrors_1.handleErr(err, res));
    }
    else {
        admin_1.isAdmin(username)
            .then((admin) => {
            if (!admin)
                throw new Error('NOT_ADMIN');
            // Call update on the user model with the given username
            return updateUser(req.params.user, req.body);
        }).then(() => res.sendStatus(200))
            .catch((err) => handleErrors_1.handleErr(err, res));
    }
};
module.exports.delete = function (req, res) {
    // Must be admin to remove a user (or the user itself)
    if (!username.localeCompare(req.params.username)) {
        // Call destroy on the user model with the given username
        updateUser(req.params.user, req.body)
            .then(() => res.sendStatus(200))
            .catch((err) => handleErrors_1.handleErr(err, res));
    }
    else {
        admin_1.isAdmin(username)
            .then((admin) => {
            if (!admin)
                throw new Error('NOT_ADMIN');
            // Call destroy on the user model with the given username and the
            // given new data
            return updateUser(req.params.user, req.body);
        }).then(() => res.sendStatus(200))
            .catch((err) => handleErrors_1.handleErr(err, res));
    }
};
function updateUser(username, newData) {
    return new Promise((resolve, reject) => {
        // Get the user to modify it afterwards
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('user').findById(username)
            .then((user) => __awaiter(this, void 0, void 0, function* () {
            if (!user)
                throw new Error('NOT_FOUND');
            // Set the new values accordingly with the new data
            if (newData.password) {
                let salt = yield bcrypt.genSalt();
                let hash = yield bcrypt.hash(newData.password, salt);
                user.set('salt', salt);
                user.set('passwordhash', hash);
            }
            if (newData.email)
                user.set('email', newData.email);
            if (newData.displayedname)
                user.set('displayedname', newData.displayedname);
            if (newData.role)
                user.set('role', newData.role);
            return user.save();
        })).then(() => resolve())
            .catch(reject);
    });
}
// Removes a given user from the database
function removeUser(username) {
    return new Promise((resolve, reject) => {
        // Call destroy on the user model with the given username
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('user').destroy({
            where: { username: username }
        }).then(() => resolve())
            .catch(reject);
    });
}
