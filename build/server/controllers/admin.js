"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plugins_1 = require("../lib/plugins");
const sequelizeWrapper_1 = require("../utils/sequelizeWrapper");
const handleErrors_1 = require("../utils/handleErrors");
const username = 'brendan'; // TEMPORARY
// Set home
module.exports.home = function (req, res) {
    // Action only possible for admin users
    isAdmin(username, (err, admin) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        if (admin) {
            // Change the home plugin according to the user input
            plugins_1.PluginConnector.getInstance(req.body.plugin, (err, connector) => {
                if (err)
                    return handleErrors_1.handleErr(err, res);
                // Check if connector is here, cause else TS will complain at compilation
                if (!connector)
                    return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
                connector.setHome(req.body.disableOld, (err) => {
                    if (err)
                        return handleErrors_1.handleErr(err, res);
                    res.sendStatus(200);
                });
            });
        }
        else {
            // Not admin, sorry :-(
            return handleErrors_1.handleErr(new Error('NOT_ADMIN'), res);
        }
    });
};
// Change plugin state
module.exports.changeState = function (req, res) {
    // Action only possible for admin users
    isAdmin(username, (err, admin) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        if (admin) {
            // Change the home plugin according to the user input
            plugins_1.PluginConnector.getInstance(req.body.plugin, (err, connector) => {
                if (err)
                    return handleErrors_1.handleErr(err, res);
                // Check if connector is here, cause else TS will complain at compilation
                if (!connector)
                    return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
                connector.setState(req.body.state, (err) => {
                    if (err)
                        return handleErrors_1.handleErr(err, res);
                    res.sendStatus(200);
                });
            });
        }
        else {
            // Not admin, sorry :-(
            return handleErrors_1.handleErr(new Error('NOT_ADMIN'), res);
        }
    });
};
// Set access level on a plugin for a given user
module.exports.setAccessLevel = function (req, res) {
    // Action only possible for admin users
    isAdmin(username, (err, admin) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        if (admin) {
            // Change the home plugin according to the user input
            plugins_1.PluginConnector.getInstance(req.body.plugin, (err, connector) => {
                if (err)
                    return handleErrors_1.handleErr(err, res);
                // Check if connector is here, cause else TS will complain at compilation
                if (!connector)
                    return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
                let level = plugins_1.AccessLevel[req.body.level];
                connector.setAccessLevel(req.body.username, level, (err) => {
                    if (err)
                        return handleErrors_1.handleErr(err, res);
                    res.sendStatus(200);
                });
            });
        }
        else {
            // Not admin, sorry :-(
            return handleErrors_1.handleErr(new Error('NOT_ADMIN'), res);
        }
    });
};
module.exports.useradd = function (req, res) { };
module.exports.userdel = function (req, res) { };
// Check if a given user has the admin role
function isAdmin(username, next) {
    let wrapper = sequelizeWrapper_1.SequelizeWrapper.getInstance();
    // Fetch the user then compare its role to the admin one
    wrapper.model('user').findById(username).then((row) => {
        next(null, plugins_1.Role[row.get('role')] === plugins_1.Role.admin);
        return null;
    }).catch(next);
}
exports.isAdmin = isAdmin;
