"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const p = require("../lib/plugins");
const handleErrors_1 = require("../utils/handleErrors");
// TODO: Check auth headers
module.exports.get = function (req, res) {
    // We must have at least one query parameter, which is the number of
    // elements to return
    if (!req.query.number) {
        return handleErrors_1.handleErr(new Error('NUMBER_MISSING'), res);
    }
    // Grab a connector and load the elements number
    p.PluginConnector.getInstance(req.params.plugin, (err, connector) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        // Check if connector is here, cause else TS will complain at compilation
        if (!connector)
            return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
        // If the plugin isn't enabled, all operations on data should fail
        connector.getState((err, state) => {
            if (err)
                return handleErrors_1.handleErr(err, res);
            if (state !== p.State.enabled)
                return handleErrors_1.handleErr(new Error('PLUGIN_DISABLED'), res);
            let options = { number: parseInt(req.query.number) };
            // Load optional filters
            if (req.query.startTimestamp)
                options.startTimestamp = req.query.startTimestamp;
            if (req.query.type)
                options.type = req.query.type;
            // Run the query
            return connector.getData(options, (err, data) => {
                if (err)
                    return handleErrors_1.handleErr(err, res);
                // Check the user's access level before returning the data
                connector.getAccessLevel('brendan', (err, level) => {
                    if (err)
                        return handleErrors_1.handleErr(err, res);
                    if (data) {
                        // If the access level is set to "none", don't return drafts
                        data = data.filter((data) => {
                            if (level === p.AccessLevel.none) {
                                if (!data.status.localeCompare('private'))
                                    return false;
                                else
                                    return true;
                            }
                            return true;
                        });
                    }
                });
                return res.status(200).send(data);
            });
        });
    });
};
module.exports.add = function (req, res) {
    // Check if the data is valid
    if (p.Data.isValid(req.body)) {
        // If data is valid, load the connector
        p.PluginConnector.getInstance(req.params.plugin, (err, connector) => {
            if (err)
                return handleErrors_1.handleErr(err, res);
            // Check if connector is here, cause else TS will complain at compilation
            if (!connector)
                return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
            // If the plugin isn't enabled, all operations on data should fail
            connector.getState((err, state) => {
                if (err)
                    return handleErrors_1.handleErr(err, res);
                if (state !== p.State.enabled)
                    return handleErrors_1.handleErr(new Error('PLUGIN_DISABLED'), res);
                // Check the user's access level before returning the data
                connector.getAccessLevel('brendan', (err, level) => {
                    if (err)
                        return handleErrors_1.handleErr(err, res);
                    // User can add data only if it has write access on the plugin's data
                    if (level === p.AccessLevel.readwrite) {
                        // Run the query
                        return connector.addData(req.body, (err) => {
                            if (err)
                                return handleErrors_1.handleErr(err, res);
                            res.sendStatus(200);
                        });
                    }
                });
            });
        });
    }
    else {
        // If the data is invalid: 400 Bad Request
        return handleErrors_1.handleErr(new Error('DATA_INVALID'), res);
    }
};
module.exports.replace = function (req, res) {
    // Check if all of the data is valid
    if (p.Data.isValid(req.body.old) && p.Data.isValid(req.body.new)) {
        p.PluginConnector.getInstance(req.params.plugin, (err, connector) => {
            if (err)
                return handleErrors_1.handleErr(err, res);
            // Check if connector is here, cause else TS will complain at compilation
            if (!connector)
                return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
            // If the plugin isn't enabled, all operations on data should fail
            connector.getState((err, state) => {
                if (err)
                    return handleErrors_1.handleErr(err, res);
                if (state !== p.State.enabled)
                    return handleErrors_1.handleErr(new Error('PLUGIN_DISABLED'), res);
                // Check the user's access level before returning the data
                connector.getAccessLevel('brendan', (err, level) => {
                    if (err)
                        return handleErrors_1.handleErr(err, res);
                    // User can edit data only if it has write access on the plugin's data
                    if (level === p.AccessLevel.readwrite) {
                        // Run the query
                        return connector.replaceData(req.body.old, req.body.new, (err) => {
                            if (err)
                                return handleErrors_1.handleErr(err, res);
                            res.sendStatus(200);
                        });
                    }
                });
            });
        });
    }
    else {
        // If the data is invalid: 400 Bad Request
        return handleErrors_1.handleErr(new Error('DATA_INVALID'), res);
    }
};
module.exports.delete = function (req, res) {
    // We must have at least one query parameter, which is the number of
    // elements to return
    if (!req.query.number) {
        return handleErrors_1.handleErr(new Error('NUMBER_MISSING'), res);
    }
    // Get connector
    p.PluginConnector.getInstance(req.params.plugin, (err, connector) => {
        if (err)
            return handleErrors_1.handleErr(err, res);
        if (!connector)
            return handleErrors_1.handleErr(new Error('CONNECTOR_MISSING'), res);
        // If the plugin isn't enabled, all operations on data should fail
        connector.getState((err, state) => {
            if (err)
                return handleErrors_1.handleErr(err, res);
            if (state !== p.State.enabled)
                return handleErrors_1.handleErr(new Error('PLUGIN_DISABLED'), res);
            let options = { number: parseInt(req.query.number) };
            // Load optional filters
            if (req.query.startTimestamp)
                options.startTimestamp = req.query.startTimestamp;
            if (req.query.type)
                options.type = req.query.type;
            // Check the user's access level before returning the data
            connector.getAccessLevel('brendan', (err, level) => {
                if (err)
                    return handleErrors_1.handleErr(err, res);
                // User can delete data only if it has write access on the plugin's data
                if (level === p.AccessLevel.readwrite) {
                    // Run the query
                    connector.deleteData(options, (err) => {
                        if (err)
                            return handleErrors_1.handleErr(err, res);
                        res.sendStatus(200);
                    });
                }
            });
        });
    });
};
