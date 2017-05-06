"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelizeWrapper_1 = require("../utils/sequelizeWrapper");
const path = require("path");
const fs = require("fs");
const revalidator = require('revalidator');
const printit = require('printit');
const log = printit({
    date: true,
    prefix: 'PluginConnector'
});
// Some names are reserved to olympus core features,
// so it's illegal to register a plugin with one of these names
const illegals = [
    'api',
    'auth'
];
// Data models for plugin's data and metadata
class Data extends Object {
    // Checks if given data is valid according to its model
    // Used to check user input at runtime
    static isValid(data) {
        if (!data.type || !data.timestamp || !data.name || !data.content || !data.status) {
            return false;
        }
        if (data.meta) {
            if (!(data.meta instanceof Object)) {
                return false;
            }
        }
        // Check if the status is in the correct format
        if (['private', 'public'].indexOf(data.status) < 0) {
            return false;
        }
        return true;
    }
}
exports.Data = Data;
class MetaData extends Object {
}
exports.MetaData = MetaData;
// Data model for query option
class Options extends Object {
}
exports.Options = Options;
// Enumerations used in the database
var State;
(function (State) {
    State[State["uninstalled"] = 0] = "uninstalled";
    State[State["disabled"] = 1] = "disabled";
    State[State["enabled"] = 2] = "enabled";
})(State = exports.State || (exports.State = {}));
var AccessLevel;
(function (AccessLevel) {
    AccessLevel[AccessLevel["none"] = 0] = "none";
    AccessLevel[AccessLevel["readonly"] = 1] = "readonly";
    AccessLevel[AccessLevel["readwrite"] = 2] = "readwrite";
})(AccessLevel = exports.AccessLevel || (exports.AccessLevel = {}));
var Role;
(function (Role) {
    Role[Role["reader"] = 0] = "reader";
    Role[Role["admin"] = 1] = "admin";
    Role[Role["editor"] = 2] = "editor";
})(Role = exports.Role || (exports.Role = {}));
// Plugin Connector class
// This is the class plugins will be using to interact with the database. This
// way, plugins won't have much knowledge of sensitive user data that doesn't
// concern them. This will be upgraded in the future with a permission system,
// allowing plugins to dialog with each other
class PluginConnector {
    // Set the plugin name and load the necessery models
    constructor(pluginName) {
        this.pluginName = pluginName;
        this.model = {
            access: sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin_access'),
            data: sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin_data'),
            plugin: sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin'),
            user: sequelizeWrapper_1.SequelizeWrapper.getInstance().model('user')
        };
    }
    // STATIC
    // Get a singleton-ised instance of the connector corresponding to the plugin
    static getInstance(pluginName, next) {
        if (!this.instances) {
            this.instances = {}; // Initialisation to empty object
        }
        if (!this.instances[pluginName]) {
            sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').count({
                where: { dirname: pluginName }
            }).then((count) => {
                this.instances[pluginName] = new PluginConnector(pluginName);
                if (!count) {
                    this.register(pluginName, (err) => {
                        if (err)
                            return next(err);
                        return next(null, this.instances[pluginName]);
                    });
                }
                else {
                    return next(null, this.instances[pluginName]);
                }
            });
        }
        else {
            return next(null, this.instances[pluginName]);
        }
    }
    // Updates schema of a given plugin based on the info in its manifest
    static updateSchema(pluginName, next) {
        try {
            // Get plugin info from its manifest
            let infos = this.getPluginInfos(pluginName);
            // Update the schema
            sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').update({
                schema: infos.schema
            }, {
                where: { dirname: pluginName }
            }).then(() => { return next(null); })
                .catch(next);
        }
        catch (e) {
            // We may get an error when trying to open a non-existing manifest
            next(e);
        }
    }
    static update(next) {
        // Define root for the plugins
        let root = path.resolve('./plugins');
        // Get all the plugins from the database
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').findAll()
            .then((plugins) => {
            let updates = plugins.map((plugin) => {
                // Check all of the plugins in a Promise
                return new Promise((resolve, reject) => {
                    let pluginPath = path.join(root, plugin.get('dirname'));
                    if (fs.existsSync(pluginPath)) {
                        // Else, load the plugin infos from its manifest
                        let infos = this.getPluginInfos(plugin.get('dirname'));
                        let newSet = {
                            description: infos.description,
                            schema: infos.schema,
                            state: plugin.get('state'),
                        };
                        // If the plugin was flagged as uninstalled but its folder
                        // is back in the /plugins directory, register it back but
                        // as disabled
                        if (State[plugin.get('state')] === State.uninstalled) {
                            log.info('Re-registered previously uninstalled plugin', plugin.get('dirname'));
                            // Enable it if set as home plugin
                            if (plugin.get('home'))
                                newSet.state = State[State.enabled];
                            else
                                newSet.state = State[State.disabled];
                        }
                        // Update the instance of the plugin
                        plugin.set(newSet);
                        // Save the updated instance in the database
                        plugin.save().then(() => {
                            log.info('Detected plugin', plugin.get('dirname'));
                            // Home has changed in the settings file
                            if (plugin.get('home') && !this.isHome(plugin.get('dirname'))) {
                                // Get the new home plugin's name
                                let newHomePlugin = require(path.resolve('./settings')).home;
                                // Get a connector on the new home plugin
                                PluginConnector.getInstance(newHomePlugin, (err, instance) => {
                                    if (err)
                                        return reject(err);
                                    if (!instance)
                                        return next(new Error('CONNECTOR_MISSING'));
                                    // Set new home plugin as new home
                                    instance.setHome(false, (err) => {
                                        if (err)
                                            return reject(err);
                                        resolve();
                                    });
                                });
                                return null;
                            }
                            else {
                                resolve();
                                return null;
                            }
                        }).catch(reject);
                    }
                    else {
                        // If the directory doesn't exist anymore, run the state change
                        plugin.set('state', State[State.uninstalled]);
                        // Save the new state in the database
                        plugin.save().then(() => {
                            log.info('Uninstalled removed plugin', plugin.get('dirname'));
                            resolve();
                        }).catch(reject);
                    }
                });
            });
            Promise.all(updates).then(() => { return next(null); }).catch(next);
            return null;
        }).catch(next);
    }
    // Get the name of the home plugin (undefined if no home plugin is set)
    static getHomePluginName(next) {
        // There should be only one home plugin
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').findOne({
            where: { home: true },
        }).then((row) => {
            next(null, row.get('dirname'));
        }).catch(next);
    }
    // Get data from all of the registered plugins
    static getPlugins(state, next) {
        let whereOptions = {};
        // Filter on the state if required
        if (state)
            whereOptions.state = State[state];
        // Get all the plugins
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').findAll({
            where: whereOptions
        }).then((rows) => {
            let ret = rows.map((row) => {
                return {
                    name: row.get('name'),
                    description: row.get('description'),
                    state: row.get('state'),
                    home: row.get('home')
                };
            });
            return next(null, ret);
        });
    }
    // If the plugin doesn't exist, getInstance will register it in the database
    static register(pluginName, next) {
        try {
            // Check if we can register the plugin with its current name
            if (illegals.indexOf(pluginName) >= 0) {
                return next(new Error('ILLEGAL_NAME: ' + pluginName));
            }
            let infos = this.getPluginInfos(pluginName);
            let schema;
            // Check if schema is defined
            if (infos.schema)
                schema = infos.schema;
            else
                schema = null; // Else, set it to null
            let state;
            // If the plugin is the home plugin, it must be enabled by default
            if (this.isHome(pluginName))
                state = State.enabled;
            else
                state = State.disabled; // Else, set it to disabled
            // We don't need to count the rows, as getInstance already does it before
            sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').create({
                dirname: pluginName,
                name: infos.name,
                description: infos.description || null,
                schema: schema,
                state: State[state],
                home: false
            }).then(() => {
                log.info('Registered new plugin', pluginName);
                if (this.isHome(pluginName)) {
                    // If the new plugin is set as home in the settings file,
                    // set is as such in the database
                    PluginConnector.getInstance(pluginName, (err, instance) => {
                        if (err)
                            return next(err);
                        if (!instance)
                            return next(new Error('CONNECTOR_MISSING'));
                        instance.setHome(false, (err) => {
                            if (err)
                                return next(err);
                            next(null);
                            return null;
                        });
                    });
                    return null;
                }
                else {
                    next(null);
                    return null;
                }
            })
                .catch(next);
        }
        catch (e) {
            return next(e);
        }
    }
    // Get plugin infos from its package.json manifest
    static getPluginInfos(pluginName) {
        let pluginsRoot = path.resolve('./plugins'); // Plugins root
        let confPath = path.join(pluginsRoot, pluginName, 'package.json');
        try {
            let conf = require(confPath);
            // Load the name, description and the metadata schema if exist
            let name = conf.displayedName || pluginName;
            let description = conf.description || null;
            let schema;
            // Check if schema is defined
            if (conf.schema) {
                // If it is, format it so revalidator can use it
                schema = { properties: conf.schema };
            }
            else {
                // Else, set it to null
                schema = null;
            }
            // Return it as a PluginInfos instance
            return {
                name: name,
                description: description,
                schema: schema,
                home: this.isHome(pluginName)
            };
        }
        catch (e) {
            throw e;
        }
    }
    // Check whether the plugin is defined as the home plugin in the app manifest
    static isHome(pluginName) {
        let homePluginName = require(path.resolve('./settings')).home;
        if (!homePluginName)
            return false;
        if (!homePluginName.localeCompare(pluginName))
            return true;
        return false;
    }
    // PUBLIC
    // Retrieve data from the database using given filters
    getData(options, next) {
        // Basic WhereOptions
        let whereOptions = { plugin: this.pluginName };
        // Generate the "WhereOptions" object on the "data" column from the
        // options we got as parameter
        let data = getDataWhereOptions(options);
        // Include conditions on the "data" column only if they exist
        if (data)
            whereOptions.data = data;
        // Run the query
        this.model.data.findAll({
            where: whereOptions,
            limit: options.number
        }).then((rows) => {
            let result = []; // Initialise to an empty array
            // Get only the "data" column for each element
            rows.map((row) => { result.push(row.get('data')); });
            // Send the result
            return next(null, result);
        }).catch(next); // If there's an error, catch it and send it
    }
    // Save the given data in the database
    addData(data, next) {
        if (!data.timestamp) {
            // The timestamp will be the data's unique identifier, so
            // we need it
            return next(new Error('TIMESTAMP_MISSING'));
        }
        this.model.data.count({
            where: {
                plugin: this.pluginName,
                data: { timestamp: data.timestamp }
            }
        }).then((count) => {
            // A timestamp must be unique as it is how we'll be identifying data
            // for the plugin
            if (count)
                return next(new Error('TIMESTAMP_EXISTS'));
            // Now check if the "meta" object respects the plugin schema if exists
            return this.isSchemaValid(data, (err, valid) => {
                if (err)
                    return next(err);
                if (valid) {
                    // Create the database entry
                    this.model.data.create({
                        plugin: this.pluginName,
                        data: data
                    }).then(() => { return next(null); }) // No result
                        .catch(next); // If there's an error, catch it and send it
                }
                else {
                    return next(new Error('METADATA_MISMATCH'));
                }
            });
        });
    }
    // Update a data row in the database. The old row is fully replaced by the new one
    // so any missing data is removed
    replaceData(oldData, newData, next) {
        if (!newData.timestamp) {
            // The timestamp will be the data's unique identifier, so
            // we need it
            return next(new Error('TIMESTAMP_MISSING'));
        }
        // Now check if the "meta" object respects the plugin schema if exists
        this.isSchemaValid(newData, (err, valid) => {
            if (err)
                return next(err);
            if (valid) {
                // Replace the database entry
                this.model.data.update({ data: newData }, {
                    where: {
                        plugin: this.pluginName,
                        data: oldData
                    }
                }).then((result) => {
                    // If no row were updated, it means we got the original data wrong
                    // so raise an error
                    if (!result[0])
                        return next(new Error('NO_ROW_UPDATED'));
                    else
                        return next(null);
                }).catch(next);
            }
            else {
                return next(new Error('METADATA_MISMATCH'));
            }
        });
    }
    // Delete data from the database selected from the given options
    deleteData(options, next) {
        // Basic WhereOptions
        let whereOptions = { plugin: this.pluginName };
        // Generate the "WhereOptions" object on the "data" column from the
        // options we got as parameter
        let data = getDataWhereOptions(options);
        // Include conditions on the "data" column only if they exist
        if (data)
            whereOptions.data = data;
        this.model.data.destroy({
            where: whereOptions
        }).then(() => { return next(null); })
            .catch(next);
    }
    // Set the plugin state
    setState(newState, next) {
        this.model.plugin.update({
            state: State[newState] // Get the string from the given state
        }, {
            where: { dirname: this.pluginName }
        }).then(() => { return next(null); })
            .catch(next);
    }
    // Get the current plugin state as a member of the State enum
    getState(next) {
        // The plugin's dirname is it's primary key
        this.model.plugin.findById(this.pluginName)
            .then((row) => {
            next(null, State[row.get('state')]);
            return null;
        })
            .catch(next); // If there's an error, catch it and send it
    }
    // Returns the user's access level on the plugin as a member of the AccessLevel enum
    getAccessLevel(username, next) {
        isAdmin(username, this.model.user, (err, admin) => {
            if (err)
                return next(err);
            // If the user is admin on the platform, it gives it read/write
            // access to all plugins
            if (admin)
                return next(null, AccessLevel.readwrite);
            // If the user isn't admin, we check the access level relative
            // to the plugin
            return this.model.access.findOne({
                where: {
                    plugin: this.pluginName,
                    user: username
                }
            }).then((row) => {
                // Casting the level as a string, because else TypeScript
                // assumes it to be an integer, and the whole thing to 
                // return a string
                if (row)
                    return next(null, AccessLevel[row.get('level')]);
                else
                    return next(null, AccessLevel.none);
            }).catch(next);
        });
    }
    // Set access level on the plugin for a given user
    setAccessLevel(username, level, next) {
        isAdmin(username, this.model.user, (err, admin) => {
            if (err)
                return next(err);
            // If the user is admin on the platform, it gives it read/write
            // access to all plugins, so we can't change it
            if (admin)
                return next(new Error('NOT_ADMIN'));
            // If the user isn't admin, we check if there's an access level to
            // add or update
            this.model.access.count({
                where: {
                    plugin: this.pluginName,
                    user: username
                }
            }).then((count) => {
                // No row exists for this user: it has no access on the plugin.
                // Let's create one.
                if (!count) {
                    // If the access level is "none", don't create a row
                    if (level === AccessLevel.none)
                        next(null);
                    return this.model.access.create({
                        plugin: this.pluginName,
                        user: username,
                        level: AccessLevel[level]
                    }).then(() => { return next(null); })
                        .catch(next);
                }
                else {
                    // A row already exists, we update it or delete it.
                    if (level === AccessLevel.none) {
                        // Passing an access level to none means removing the
                        // row from the database
                        this.model.access.destroy({
                            where: {
                                plugin: this.pluginName,
                                user: username
                            }
                        }).then(() => {
                            next(null);
                            return null;
                        })
                            .catch(next);
                    }
                    else {
                        // If the access level isn't "none", just update the row
                        this.model.access.update({
                            level: AccessLevel[level]
                        }, {
                            where: {
                                plugin: this.pluginName,
                                user: username
                            }
                        }).then(() => {
                            next(null);
                            return null;
                        })
                            .catch(next);
                    }
                }
                return null;
            });
        });
    }
    // Move the home flag to the given plugin
    setHome(disableOld, next) {
        // First check if the plugin exists
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').count({
            where: { dirname: this.pluginName }
        }).then((count) => {
            if (!count)
                return next(new Error('NO_PLUGIN')); // Plugin doesn't exist
            this.removeHomeFlag(disableOld, (err) => {
                if (err)
                    return next(err);
                this.setHomeFlag(this.pluginName, (err) => {
                    if (err)
                        return next(err);
                    log.info('Set', this.pluginName, 'as the new home plugin');
                    return next(null);
                });
            });
            return null;
        }).catch(next);
    }
    // PRIVATE
    // Removes the home flag of the current home plugin
    removeHomeFlag(disableOld, next) {
        let updatedValues = {
            home: false,
            state: State[State.enabled] // The previous home plugin is obviously enabled
        };
        // If the disableOld boolean is set to true, we disable the previous home plugin
        if (disableOld)
            updatedValues.state = State[State.disabled];
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').update(updatedValues, {
            where: { home: true }
        }).then(() => {
            next(null);
            return null;
        }).catch(next);
    }
    // Set home flag to given plugin
    setHomeFlag(pluginName, next) {
        sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').update({
            home: true,
            state: State[State.enabled] // Enable the new home plugin
        }, {
            where: { dirname: pluginName }
        }).then(() => { return next(null); })
            .catch(next);
    }
    // Check if the provided metadata is valid agains the plugin schema
    isSchemaValid(data, next) {
        // Check if a schema is defined first
        this.model.plugin.findById(this.pluginName).then((row) => {
            let schema = row.get('schema');
            if (schema && Object.keys(schema).length) {
                // Determining if the "meta" sub-object is required
                let required = false;
                for (let metadata in schema) {
                    if (schema[metadata].required)
                        required = true;
                }
                // Run the check only if at least one metadata is required
                if (data.meta && Object.keys(data.meta).length) {
                    // Run the check
                    if (revalidator.validate(data.meta, schema).valid) {
                        return next(null, true);
                    }
                    else {
                        return next(null, false);
                    }
                }
                else if (!required) {
                    // If no metadata are required, we don't care if there's a
                    // "meta" sub-object or not
                    return next(null, true);
                }
                else {
                    return next(null, false); // No metadata where metadata was expected
                }
            }
            else {
                return next(null, true); // No schema in db: No need to check
            }
        }).catch(next);
    }
}
exports.PluginConnector = PluginConnector;
// INTERNAL
class PluginInfos {
}
// Use a given Sequelize model to check if a user with a given username is admin
function isAdmin(username, model, next) {
    // Find user from its unique username
    model.findById(username).then((row) => {
        // If no user, well, no admin
        if (!row)
            return next(null, false);
        // Compare the role with the one we have in the Role enum
        return next(null, row.get('role').localeCompare(Role[Role.admin]) === 0);
    }).catch(next); // Error handling
}
// Generate a Sequelize WhereOptions instance if needed from the options
function getDataWhereOptions(options) {
    let data = {};
    // If no type nor timestamp has been given, we don't need a WhereOptions
    // object
    if (!options.type && !options.startTimestamp) {
        return null;
    }
    // Check if type is provided
    if (options.type) {
        data.type = options.type;
    }
    // Check if starting timestamp is provided
    if (options.startTimestamp) {
        data.timestamp = {
            $lte: options.startTimestamp
        };
    }
    return data;
}
