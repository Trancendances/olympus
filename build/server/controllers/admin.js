"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plugins_1 = require("../lib/plugins");
const sequelizeWrapper_1 = require("../utils/sequelizeWrapper");
const handleErrors_1 = require("../utils/handleErrors");
const username = 'brendan'; // TEMPORARY
// Set home
module.exports.home = function (req, res) {
    // Action only possible for admin users
    isAdmin(username)
        .then((admin) => {
        if (admin) {
            // Change the home plugin according to the user input
            return plugins_1.PluginConnector.getInstance(req.body.plugin);
        }
        else {
            // Not admin, sorry :-(
            throw new Error('NOT_ADMIN');
        }
    }).then((connector) => {
        // Check if connector is here, cause else TS will complain at compilation
        if (!connector)
            throw new Error('CONNECTOR_MISSING');
        return connector.setHome(req.body.disableOld);
    }).then(() => res.sendStatus(200)).catch((e) => handleErrors_1.handleErr(e, res));
};
// Change plugin state
module.exports.changeState = function (req, res) {
    // Action only possible for admin users
    isAdmin(username)
        .then((admin) => {
        if (admin) {
            // Change the home plugin according to the user input
            return plugins_1.PluginConnector.getInstance(req.body.plugin);
        }
        else {
            // Not admin, sorry :-(
            throw new Error('NOT_ADMIN');
        }
    }).then((connector) => {
        // Check if connector is here, cause else TS will complain at compilation
        if (!connector)
            throw new Error('CONNECTOR_MISSING');
        return connector.setState(req.body.state);
    }).then(() => res.sendStatus(200)).catch((e) => handleErrors_1.handleErr(e, res));
};
// Set access level on a plugin for a given user
module.exports.setAccessLevel = function (req, res) {
    // Action only possible for admin users
    isAdmin(username)
        .then((admin) => {
        if (admin) {
            return plugins_1.PluginConnector.getInstance(req.body.plugin);
        }
        else {
            // Not admin, sorry :-(
            throw new Error('NOT_ADMIN');
        }
    }).then((connector) => {
        // Check if connector is here, cause else TS will complain at compilation
        if (!connector)
            throw new Error('CONNECTOR_MISSING');
        let level = plugins_1.AccessLevel[req.body.level];
        return connector.setAccessLevel(req.body.username, level);
    }).then(() => res.sendStatus(200)).catch((e) => handleErrors_1.handleErr(e, res));
};
module.exports.useradd = function (req, res) { };
module.exports.userdel = function (req, res) { };
// Check if a given user has the admin role
function isAdmin(username) {
    return new Promise((reject, resolve) => {
        let wrapper = sequelizeWrapper_1.SequelizeWrapper.getInstance();
        // Fetch the user then compare its role to the admin one
        wrapper.model('user').findById(username)
            .then((row) => {
            let admin = plugins_1.Role[row.get('role')] === plugins_1.Role.admin;
            return resolve(admin);
        }).catch(reject);
    });
}
exports.isAdmin = isAdmin;
