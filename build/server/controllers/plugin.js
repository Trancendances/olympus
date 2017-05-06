"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const p = require("../lib/plugins");
const handleErrors_1 = require("../utils/handleErrors");
const admin_1 = require("./admin");
const username = 'brendan'; // TEMPORARY
module.exports.home = function (req, res, next) {
    p.PluginConnector.getHomePluginName((err, name) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        res.status(200).send(name);
    });
};
module.exports.state = function (req, res, next) {
    p.PluginConnector.getInstance(req.params.plugin, (err, connector) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        // Check if connector is here, cause else TS will complain at compilation
        if (!connector)
            return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
        connector.getState((err, state) => {
            if (err)
                return handleErrors_1.handleErr(err, res);
            res.status(200).send(p.State[state]);
        });
    });
};
module.exports.getList = function (req, res, next) {
    admin_1.isAdmin(username, (err, admin) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        if (admin) {
            // If the user is admin, retrieve all plugins
            p.PluginConnector.getPlugins(null, (err, plugins) => {
                res.status(200).send(plugins);
            });
        }
        else {
            // If the user isn't admin, only retrieve enabled plugins
            p.PluginConnector.getPlugins(p.State.enabled, (err, plugins) => {
                res.status(200).send(plugins);
            });
        }
    });
};
