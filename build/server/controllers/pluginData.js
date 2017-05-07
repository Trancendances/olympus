"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Plugins = require("../lib/plugins");
const handleErrors_1 = require("../utils/handleErrors");
// TODO: Check auth headers
module.exports.get = function (req, res) {
    let connector;
    let data;
    // We must have at least one query parameter, which is the number of
    // elements to return
    if (!req.query.number) {
        return handleErrors_1.handleErr(new Error('NUMBER_MISSING'), res);
    }
    // Grab a connector and load the elements number
    Plugins.PluginConnector.getInstance(req.params.plugin)
        .then((res) => {
        connector = res;
        // Check if connector is here, cause else TS will complain at compilation
        if (!connector)
            throw new Error('CONNECTOR_MISSING');
        // If the plugin isn't enabled, all operations on data should fail
        return connector.getState();
    }).then((state) => {
        if (state !== Plugins.State.enabled)
            throw new Error('PLUGIN_DISABLED');
        let options = { number: parseInt(req.query.number) };
        // Load optional filters
        if (req.query.startTimestamp)
            options.startTimestamp = req.query.startTimestamp;
        if (req.query.type)
            options.type = req.query.type;
        // Run the query
        return connector.getData(options);
    }).then((res) => {
        data = res;
        // Check the user's access level before returning the data
        return connector.getAccessLevel('brendan');
    }).then((level) => {
        if (data) {
            // If the access level is set to "none", don't return drafts
            data = data.filter((data) => {
                if (level === Plugins.AccessLevel.none) {
                    if (!data.status.localeCompare('private'))
                        return false;
                    else
                        return true;
                }
                return true;
            });
        }
        res.status(200).send(data);
    }).catch((e) => handleErrors_1.handleErr(e, res));
};
module.exports.add = function (req, res) {
    // Check if the data is valid
    if (Plugins.Data.isValid(req.body)) {
        let connector;
        let state;
        // If data is valid, load the connector
        Plugins.PluginConnector.getInstance(req.params.plugin)
            .then((res) => {
            connector = res;
            // Check if connector is here, cause else TS will complain at compilation
            if (!connector)
                throw new Error('CONNECTOR_MISSING');
            // If the plugin isn't enabled, all operations on data should fail
            return connector.getState();
        }).then((res) => {
            state = res;
            if (state !== Plugins.State.enabled)
                throw new Error('PLUGIN_DISABLED');
            // Check the user's access level before returning the data
            return connector.getAccessLevel('brendan'); // TODO: Replace hard-coded username
        }).then((level) => {
            // User can add data only if it has write access on the plugin's data
            if (level === Plugins.AccessLevel.readwrite) {
                // Run the query
                return connector.addData(req.body);
            }
            else {
                throw new Error('UNAUTHORISED');
            }
        }).then(() => res.sendStatus(200))
            .catch((e) => handleErrors_1.handleErr(e, res));
    }
    else {
        // If the data is invalid: 400 Bad Request
        return handleErrors_1.handleErr(new Error('DATA_INVALID'), res);
    }
};
module.exports.replace = function (req, res) {
    // Check if all of the data is valid
    if (Plugins.Data.isValid(req.body.old) && Plugins.Data.isValid(req.body.new)) {
        let connector;
        let state;
        Plugins.PluginConnector.getInstance(req.params.plugin)
            .then((res) => {
            connector = res;
            // Check if connector is here, cause else TS will complain at compilation
            if (!connector)
                throw new Error('CONNECTOR_MISSING');
            // If the plugin isn't enabled, all operations on data should fail
            return connector.getState();
        }).then((res) => {
            state = res;
            if (state !== Plugins.State.enabled)
                throw new Error('PLUGIN_DISABLED');
            // Check the user's access level before returning the data
            return connector.getAccessLevel('brendan'); // TODO: Replace hard-coded username
        }).then((level) => {
            // User can edit data only if it has write access on the plugin's data
            if (level === Plugins.AccessLevel.readwrite) {
                // Run the query
                return connector.replaceData(req.body.old, req.body.new);
            }
            else {
                throw new Error('UNAUTHORISED');
            }
        }).then(() => res.sendStatus(200))
            .catch((e) => handleErrors_1.handleErr(e, res));
    }
    else {
        // If the data is invalid: 400 Bad Request
        return handleErrors_1.handleErr(new Error('DATA_INVALID'), res);
    }
};
module.exports.delete = function (req, res) {
    let connector;
    let state;
    // We must have at least one query parameter, which is the number of
    // elements to return
    if (!req.query.number) {
        return handleErrors_1.handleErr(new Error('NUMBER_MISSING'), res);
    }
    // Get connector
    Plugins.PluginConnector.getInstance(req.params.plugin)
        .then((res) => {
        connector = res;
        if (!connector)
            throw new Error('CONNECTOR_MISSING');
        // If the plugin isn't enabled, all operations on data should fail
        return connector.getState();
    }).then((res) => {
        state = res;
        if (state !== Plugins.State.enabled)
            throw new Error('PLUGIN_DISABLED');
        // Check the user's access level before returning the data
        return connector.getAccessLevel('brendan'); // TODO: Replace hard-coded username
    }).then((level) => {
        // User can delete data only if it has write access on the plugin's data
        if (level === Plugins.AccessLevel.readwrite) {
            let options = { number: parseInt(req.query.number) };
            // Load optional filters
            if (req.query.startTimestamp)
                options.startTimestamp = req.query.startTimestamp;
            if (req.query.type)
                options.type = req.query.type;
            // Run the query
            return connector.deleteData(options);
        }
        else {
            throw new Error('UNAUTHORISED');
        }
    }).then(() => res.sendStatus(200))
        .catch((e) => handleErrors_1.handleErr(e, res));
};
