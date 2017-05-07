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
    static getInstance(pluginName) {
        return new Promise((resolve, reject) => {
            if (!this.instances) {
                this.instances = {}; // Initialisation to empty object
            }
            if (!this.instances[pluginName]) {
                sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').count({
                    where: { dirname: pluginName }
                }).then((count) => {
                    this.instances[pluginName] = new PluginConnector(pluginName);
                    if (!count) {
                        return this.register(pluginName);
                    }
                    else {
                        return Promise.resolve();
                    }
                }).then(() => resolve(this.instances[pluginName]))
                    .catch((e) => reject(e));
            }
            else {
                return resolve(this.instances[pluginName]);
            }
        });
    }
    static update() {
        return new Promise((resolve, reject) => {
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
                            plugin.save()
                                .then(() => {
                                log.info('Detected plugin', plugin.get('dirname'));
                                // Home has changed in the settings file
                                if (plugin.get('home') && !this.isHome(plugin.get('dirname'))) {
                                    // Get the new home plugin's name
                                    let newHomePlugin = require(path.resolve('./settings')).home;
                                    // Get a connector on the new home plugin
                                    return PluginConnector.getInstance(newHomePlugin);
                                }
                                else {
                                    return Promise.reject('break');
                                }
                            }).then((instance) => {
                                if (!instance)
                                    throw new Error('CONNECTOR_MISSING');
                                // Set new home plugin as new home
                                // Have to cast because TypeScript's promise type
                                // inference sucks
                                return instance.setHome(false);
                            }).then(() => resolve()).catch((e) => {
                                if (e instanceof Error) {
                                    return reject(e);
                                }
                            });
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
                Promise.all(updates).then(() => resolve()).catch(reject);
            }).catch(reject);
        });
    }
    // Get the name of the home plugin
    static getHomePluginName() {
        return new Promise((resolve, reject) => {
            // There should be only one home plugin
            sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').findOne({
                where: { home: true },
            }).then((row) => {
                if (!row)
                    throw new Error('NO_HOME');
                resolve(row.get('dirname'));
            }).catch(reject);
        });
    }
    // Get data from all of the registered plugins
    static getPlugins(state) {
        return new Promise((resolve, reject) => {
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
                return resolve(ret);
            }).catch(reject);
        });
    }
    // If the plugin doesn't exist, getInstance will register it in the database
    static register(pluginName) {
        return new Promise((resolve, reject) => {
            try {
                // Check if we can register the plugin with its current name
                if (illegals.indexOf(pluginName) >= 0) {
                    throw new Error('ILLEGAL_NAME: ' + pluginName);
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
                        return PluginConnector.getInstance(pluginName);
                    }
                    else {
                        // Early break because we don't have to set a home flag
                        return Promise.reject('break');
                    }
                }).then((instance) => {
                    if (!instance)
                        throw new Error('CONNECTOR_MISSING');
                    return instance.setHome(false);
                }).then(() => {
                    return resolve();
                }).catch((e) => {
                    if (e instanceof Error) {
                        return reject(e);
                    }
                });
            }
            catch (e) {
                reject(e);
            }
        });
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
    getData(options) {
        return new Promise((resolve, reject) => {
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
                return resolve(result);
            }).catch(reject); // If there's an error, catch it and send it
        });
    }
    // Save the given data in the database
    addData(data) {
        return new Promise((resolve, reject) => {
            if (!data.timestamp) {
                // The timestamp will be the data's unique identifier, so
                // we need it
                throw new Error('TIMESTAMP_MISSING');
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
                    throw new Error('TIMESTAMP_EXISTS');
                // Now check if the "meta" object respects the plugin schema if exists
                return this.isSchemaValid(data);
            }).then((valid) => {
                if (valid) {
                    // Create the database entry
                    return this.model.data.create({
                        plugin: this.pluginName,
                        data: data
                    });
                }
                else {
                    throw new Error('METADATA_MISMATCH');
                }
            }).then((created) => resolve(created.get('data'))).catch(reject);
        });
    }
    // Update a data row in the database. The old row is fully replaced by the new one
    // so any missing data is removed
    replaceData(oldData, newData) {
        return new Promise((resolve, reject) => {
            if (!newData.timestamp) {
                // The timestamp will be the data's unique identifier, so
                // we need it
                throw new Error('TIMESTAMP_MISSING');
            }
            // Now check if the "meta" object respects the plugin schema if exists
            this.isSchemaValid(newData)
                .then((valid) => {
                if (valid) {
                    // Replace the database entry
                    return this.model.data.update({ data: newData }, {
                        where: {
                            plugin: this.pluginName,
                            data: oldData
                        }
                    });
                }
                else {
                    throw new Error('METADATA_MISMATCH');
                }
            }).then((result) => {
                // If no row were updated, it means we got the original data wrong
                // so raise an error
                if (!result[0])
                    return reject(new Error('NO_ROW_UPDATED'));
                else
                    return resolve();
            }).catch(reject);
        });
    }
    // Delete data from the database selected from the given options
    deleteData(options) {
        return new Promise((resolve, reject) => {
            // Basic WhereOptions
            let whereOptions = { plugin: this.pluginName };
            // Generate the "WhereOptions" object on the "data" column from the
            // options we got as parameter
            let data = getDataWhereOptions(options);
            // Include conditions on the "data" column only if they exist
            if (data)
                whereOptions.data = data;
            this.model.data.destroy({ where: whereOptions })
                .then(() => resolve()).catch(reject);
        });
    }
    // Set the plugin state
    setState(newState) {
        return new Promise((resolve, reject) => {
            this.model.plugin.update({
                state: State[newState] // Get the string from the given state
            }, {
                where: { dirname: this.pluginName }
            }).then(() => resolve(null)).catch(reject);
        });
    }
    // Get the current plugin state as a member of the State enum
    getState() {
        return new Promise((resolve, reject) => {
            // The plugin's dirname is it's primary key
            this.model.plugin.findById(this.pluginName)
                .then((row) => {
                resolve(State[row.get('state')]);
                return null;
            }).catch(reject); // If there's an error, catch it and send it
        });
    }
    // Returns the user's access level on the plugin as a member of the AccessLevel enum
    getAccessLevel(username) {
        return new Promise((resolve, reject) => {
            isAdmin(username, this.model.user)
                .then((admin) => {
                // If the user is admin on the platform, it gives it read/write
                // access to all plugins
                if (admin)
                    return resolve(AccessLevel.readwrite);
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
                        return resolve(AccessLevel[row.get('level')]);
                    else
                        return resolve(AccessLevel.none);
                }).catch(reject);
            }).catch(reject);
        });
    }
    // Set access level on the plugin for a given user
    setAccessLevel(username, level) {
        return new Promise((resolve, reject) => {
            isAdmin(username, this.model.user)
                .then((admin) => {
                // If the user is admin on the platform, it gives it read/write
                // access to all plugins, so we can't change it
                // Sending the NOT_ADMIN error cause the current user (as all others)
                // isn't privileged enough to downgrade an admin's access
                if (admin)
                    throw new Error('NOT_ADMIN');
                // If the user isn't admin, we check if there's an access level to
                // add or update
                return this.model.access.count({
                    where: {
                        plugin: this.pluginName,
                        user: username
                    }
                });
            })
                .then((count) => {
                // No row exists for this user: it has no access on the plugin.
                // Let's create one.
                if (!count) {
                    // If the access level is "none", don't create a row
                    if (level === AccessLevel.none)
                        return Promise.resolve();
                    return this.model.access.create({
                        plugin: this.pluginName,
                        user: username,
                        level: AccessLevel[level]
                    });
                }
                else {
                    // A row already exists, we update it or delete it.
                    if (level === AccessLevel.none) {
                        // Passing an access level to none means removing the
                        // row from the database
                        return this.model.access.destroy({
                            where: {
                                plugin: this.pluginName,
                                user: username
                            }
                        });
                    }
                    else {
                        // If the access level isn't "none", just update the row
                        return this.model.access.update({
                            level: AccessLevel[level]
                        }, {
                            where: {
                                plugin: this.pluginName,
                                user: username
                            }
                        });
                    }
                }
            }).then(() => resolve()).catch(reject);
        });
    }
    // Move the home flag to the given plugin
    setHome(disableOld) {
        return new Promise((resolve, reject) => {
            // First check if the plugin exists
            sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').count({
                where: { dirname: this.pluginName }
            })
                .then((count) => {
                if (!count)
                    throw new Error('NO_PLUGIN'); // Plugin doesn't exist
                return this.removeHomeFlag(disableOld);
            })
                .then(() => this.setHomeFlag(this.pluginName))
                .then(() => {
                log.info('Set', this.pluginName, 'as the new home plugin');
                return resolve();
            }).catch(reject);
        });
    }
    // PRIVATE
    // Removes the home flag of the current home plugin
    removeHomeFlag(disableOld) {
        return new Promise((resolve, reject) => {
            let updatedValues = {
                home: false,
                state: State[State.enabled] // The previous home plugin is obviously enabled
            };
            // If the disableOld boolean is set to true, we disable the previous home plugin
            if (disableOld)
                updatedValues.state = State[State.disabled];
            sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').update(updatedValues, {
                where: { home: true }
            }).then(() => resolve()).catch(reject);
        });
    }
    // Set home flag to given plugin
    setHomeFlag(pluginName) {
        return new Promise((resolve, reject) => {
            sequelizeWrapper_1.SequelizeWrapper.getInstance().model('plugin').update({
                home: true,
                state: State[State.enabled] // Enable the new home plugin
            }, {
                where: { dirname: pluginName }
            }).then(() => resolve()).catch(reject);
        });
    }
    // Check if the provided metadata is valid agains the plugin schema
    isSchemaValid(data) {
        return new Promise((resolve, reject) => {
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
                            return resolve(true);
                        }
                        else {
                            return resolve(false);
                        }
                    }
                    else if (!required) {
                        // If no metadata are required, we don't care if there's a
                        // "meta" sub-object or not
                        return resolve(true);
                    }
                    else {
                        return resolve(false); // No metadata where metadata was expected
                    }
                }
                else {
                    return resolve(true); // No schema in db: No need to check
                }
            }).catch(reject);
        });
    }
}
exports.PluginConnector = PluginConnector;
// INTERNAL
class PluginInfos {
}
// Use a given Sequelize model to check if a user with a given username is admin
function isAdmin(username, model) {
    return new Promise((resolve, reject) => {
        // Find user from its unique username
        model.findById(username).then((row) => {
            // If no user, well, no admin
            if (!row)
                return resolve(false);
            // Compare the role with the one we have in the Role enum
            return resolve(row.get('role').localeCompare(Role[Role.admin]) === 0);
        }).catch(reject); // Error handling
    });
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
