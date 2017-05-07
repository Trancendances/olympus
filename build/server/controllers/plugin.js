"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Plugins = require("../lib/plugins");
const handleErrors_1 = require("../utils/handleErrors");
const admin_1 = require("./admin");
const username = 'brendan'; // TEMPORARY
module.exports.home = function (req, res, next) {
    Plugins.PluginConnector.getHomePluginName()
        .then((name) => res.status(200).send(name))
        .catch((err) => handleErrors_1.handleErr(err, res));
    ;
};
module.exports.state = function (req, res, next) {
    Plugins.PluginConnector.getInstance(req.params.plugin)
        .then((connector) => {
        // Check if connector is here, cause else TS will complain at compilation
        if (!connector)
            throw new Error('CONNECTOR_MISSING');
        return connector.getState();
    }).then((state) => res.status(200).send(Plugins.State[state]))
        .catch((err) => handleErrors_1.handleErr(err, res));
};
module.exports.getList = function (req, res, next) {
    admin_1.isAdmin(username)
        .then((admin) => {
        if (admin) {
            // If the user is admin, retrieve all plugins
            return Plugins.PluginConnector.getPlugins();
        }
        else {
            // If the user isn't admin, only retrieve enabled plugins
            return Plugins.PluginConnector.getPlugins(Plugins.State.enabled);
        }
    }).then((plugins) => res.status(200).send(plugins))
        .catch((err) => handleErrors_1.handleErr(err, res));
};
