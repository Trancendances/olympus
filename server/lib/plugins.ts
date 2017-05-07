import * as s from 'sequelize';
import {SequelizeWrapper} from '../utils/sequelizeWrapper';
import * as path from 'path';
import * as fs from 'fs'

const revalidator		= require('revalidator');
const printit			= require('printit');
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

export abstract class Data extends Object {
	type: string;
	timestamp: number;
	name: string;
	content: string;
	status: string;
	meta?: MetaData

	// Checks if given data is valid according to its model
	// Used to check user input at runtime
	public static isValid(data: Data) {
		if(!data.type || !data.timestamp || !data.name || !data.content || !data.status) {
			return false;
		}
		
		if(data.meta) {
			if(!(data.meta instanceof Object)) {
				return false;
			}
		}

		// Check if the status is in the correct format
		if(['private', 'public'].indexOf(data.status) < 0) {
			return false;
		}

		return true;
	}
}

export abstract class MetaData extends Object {
	[property: string]: any;
}

// Data model for query option

export abstract class Options extends Object {
	type?: string;
	number: number;
	startTimestamp?: number;
}

// Enumerations used in the database

export enum State {
	uninstalled, // Has been installed before but isn't anymore
	disabled,
	enabled
}

export enum AccessLevel {
	none,
	readonly,
	readwrite
}

export enum Role {
	reader,
	admin,
	editor
}

// Plugin Connector class
// This is the class plugins will be using to interact with the database. This
// way, plugins won't have much knowledge of sensitive user data that doesn't
// concern them. This will be upgraded in the future with a permission system,
// allowing plugins to dialog with each other
export class PluginConnector {
	private readonly pool;
	private readonly model: {
		access: s.Model<any,any>,
		data: s.Model<any,any>,
		plugin: s.Model<any,any>,
		user: s.Model<any,any>
	};
	private static instances: {
		[pluginName: string]: PluginConnector;
	};

	// Set the plugin name and load the necessery models
	private constructor(private readonly pluginName: string) {
		this.model = {
			access: SequelizeWrapper.getInstance().model('plugin_access'),
			data: SequelizeWrapper.getInstance().model('plugin_data'),
			plugin: SequelizeWrapper.getInstance().model('plugin'),
			user: SequelizeWrapper.getInstance().model('user')
		}
	}

	// STATIC

	// Get a singleton-ised instance of the connector corresponding to the plugin
	public static getInstance(pluginName: string): Promise<PluginConnector> {
		return new Promise<PluginConnector>((resolve, reject) => {
			if(!this.instances) {
				this.instances = {}; // Initialisation to empty object
			}
			if(!this.instances[pluginName]) {
				SequelizeWrapper.getInstance().model('plugin').count(<s.CountOptions>{ 
					where: <s.WhereOptions>{ dirname: pluginName }
				}).then((count) => {
					this.instances[pluginName] = new PluginConnector(pluginName);
					if(!count) {
						return this.register(pluginName)
					} else {
						return Promise.resolve();
					}
				}).then(() => resolve(this.instances[pluginName]))
				.catch((e) => reject(e));
			} else {
				return resolve(this.instances[pluginName]);
			}
		})
	}

	public static update(): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			// Define root for the plugins
			let root = path.resolve('./plugins');
			// Get all the plugins from the database
			SequelizeWrapper.getInstance().model('plugin').findAll()
			.then((plugins: s.Instance<any>[]) => {
				let updates = plugins.map((plugin) => {
					// Check all of the plugins in a Promise
					return new Promise<null>((resolve, reject) => {
						let pluginPath = path.join(root, plugin.get('dirname'));
						if(fs.existsSync(pluginPath)) {
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
							if(State[<string>plugin.get('state')] === State.uninstalled) {
								log.info('Re-registered previously uninstalled plugin', plugin.get('dirname'));
								// Enable it if set as home plugin
								if(plugin.get('home')) newSet.state = State[State.enabled];
								else newSet.state = State[State.disabled];
							}
							// Update the instance of the plugin
							plugin.set(newSet);
							// Save the updated instance in the database
							plugin.save()
							.then(() => {
								log.info('Detected plugin', plugin.get('dirname'));
								// Home has changed in the settings file
								if(plugin.get('home') && !this.isHome(plugin.get('dirname'))) {
									// Get the new home plugin's name
									let newHomePlugin = require(path.resolve('./settings')).home;
									// Get a connector on the new home plugin
									return PluginConnector.getInstance(newHomePlugin)
								} else {
									return Promise.reject('break');
								}
							}).then((instance: any) => {
									if(!instance) throw new Error('CONNECTOR_MISSING');
									// Set new home plugin as new home
									// Have to cast because TypeScript's promise type
									// inference sucks
									return (instance as PluginConnector).setHome(false)
							}).then(() => resolve()).catch((e) => {
								if(e instanceof Error) {
									return reject(e);
								}
							});
						} else {
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
	public static getHomePluginName(): Promise<string> {
		return new Promise<string | undefined>((resolve, reject) => {
			// There should be only one home plugin
			SequelizeWrapper.getInstance().model('plugin').findOne(<s.FindOptions>{
				where: <s.WhereOptions>{ home: true },
			}).then((row: s.Instance<any>) => {
				if(!row) throw new Error('NO_HOME');
				resolve(row.get('dirname'))
			}).catch(reject);
		})
	}

	// Get data from all of the registered plugins
	public static getPlugins(state?: State): Promise<any[]> {
		return new Promise<any[]>((resolve, reject) => {
			let whereOptions: s.WhereOptions = {};
			// Filter on the state if required
			if(state) whereOptions.state = State[state];
			// Get all the plugins
			SequelizeWrapper.getInstance().model('plugin').findAll({
				where: whereOptions
			}).then((rows: s.Instance<any>[]) => {
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
	private static register(pluginName: string): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			try {
				// Check if we can register the plugin with its current name
				if(illegals.indexOf(pluginName) >= 0) {
					throw new Error('ILLEGAL_NAME: ' + pluginName);
				}
				
				let infos: PluginInfos = this.getPluginInfos(pluginName);			
				let schema;
				// Check if schema is defined
				if(infos.schema) schema = infos.schema;
				else schema = null; // Else, set it to null
				
				let state: State;
				// If the plugin is the home plugin, it must be enabled by default
				if(this.isHome(pluginName)) state = State.enabled;
				else state = State.disabled // Else, set it to disabled
				
				// We don't need to count the rows, as getInstance already does it before
				SequelizeWrapper.getInstance().model('plugin').create({
					dirname: pluginName,
					name: infos.name,
					description: infos.description || null,
					schema: schema,
					state: State[state],
					home: false
				}).then(() => {
					log.info('Registered new plugin', pluginName);
					if(this.isHome(pluginName)) {
						// If the new plugin is set as home in the settings file,
						// set is as such in the database
						return PluginConnector.getInstance(pluginName);
					} else {
						// Early break because we don't have to set a home flag
						return Promise.reject('break');
					}
				}).then((instance: PluginConnector) => {					
					if(!instance) throw new Error('CONNECTOR_MISSING');
					return instance.setHome(false);
				}).then(() => {
					return resolve();
				}).catch((e) => {
					if(e instanceof Error) {
						return reject(e);
					}
				});
			} catch(e) {
				reject(e);
			}
		})
	}

	// Get plugin infos from its package.json manifest
	private static getPluginInfos(pluginName: string): PluginInfos {
		let pluginsRoot: string = path.resolve('./plugins'); // Plugins root
		let confPath: string = path.join(pluginsRoot, pluginName, 'package.json');
		try { // Check if package.json exists
			let conf = require(confPath);
			// Load the name, description and the metadata schema if exist
			let name = conf.displayedName || pluginName;
			let description = conf.description || null;
			let schema;
			// Check if schema is defined
			if(conf.schema) {
				// If it is, format it so revalidator can use it
				schema = { properties: conf.schema };
			} else {
				// Else, set it to null
				schema = null;
			}
			// Return it as a PluginInfos instance
			return <PluginInfos>{
				name: name,
				description: description,
				schema: schema,
				home: this.isHome(pluginName)
			}
		} catch(e) {
			throw e;
		}
	}
	
	// Check whether the plugin is defined as the home plugin in the app manifest
	private static isHome(pluginName: string): boolean {
		let homePluginName: string = require(path.resolve('./settings')).home;
		if(!homePluginName) return false;
		if(!homePluginName.localeCompare(pluginName)) return true;
		return false;
	}

	// PUBLIC

	// Retrieve data from the database using given filters
	public getData(options: Options): Promise<Data[]> {
		return new Promise<Data[]>((resolve, reject) => {
			// Basic WhereOptions
			let whereOptions: s.WhereOptions = { plugin: this.pluginName };
			
			// Generate the "WhereOptions" object on the "data" column from the
			// options we got as parameter
			let data: s.WhereOptions | null = getDataWhereOptions(options);
			
			// Include conditions on the "data" column only if they exist
			if(data) whereOptions.data = data;
			
			// Run the query
			this.model.data.findAll(<s.FindOptions>{
				where: whereOptions,
				limit: options.number
			}).then((rows) => {
				let result: Data[] = []; // Initialise to an empty array
				// Get only the "data" column for each element
				rows.map((row) => { result.push(<Data>row.get('data')); });
				// Send the result
				return resolve(result);
			}).catch(reject); // If there's an error, catch it and send it
		})
	}

	// Save the given data in the database
	public addData(data: Data): Promise<Data> {
		return new Promise<Data>((resolve, reject) => {
			if(!data.timestamp) {
				// The timestamp will be the data's unique identifier, so
				// we need it
				throw new Error('TIMESTAMP_MISSING');
			}
			
			this.model.data.count(<s.CountOptions>{ 
				where: <s.WhereOptions>{
					plugin: this.pluginName,
					data: { timestamp: data.timestamp }
				}
			}).then((count) => {
				// A timestamp must be unique as it is how we'll be identifying data
				// for the plugin
				if(count) throw new Error('TIMESTAMP_EXISTS');
				// Now check if the "meta" object respects the plugin schema if exists
				return this.isSchemaValid(data)
			}).then((valid) => {
				if(valid) {
					// Create the database entry
					return this.model.data.create(<s.CreateOptions>{
						plugin: this.pluginName,
						data: data
					});
				} else {
					throw new Error('METADATA_MISMATCH');
				}
			}).then((created: any) => resolve(created.get('data'))).catch(reject);
		})
	}
	
	// Update a data row in the database. The old row is fully replaced by the new one
	// so any missing data is removed
	public replaceData(oldData: Data, newData: Data): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			if(!newData.timestamp) {
				// The timestamp will be the data's unique identifier, so
				// we need it
				throw new Error('TIMESTAMP_MISSING');
			}
			
			// Now check if the "meta" object respects the plugin schema if exists
			this.isSchemaValid(newData)
			.then((valid) => {
				if(valid) {
					// Replace the database entry
					return this.model.data.update({ data: newData }, <s.UpdateOptions>{
						where: <s.WhereOptions> {
							plugin: this.pluginName,
							data: oldData
						}
					})
				} else {
					throw new Error('METADATA_MISMATCH');
				}				
			}).then((result) => {
				// If no row were updated, it means we got the original data wrong
				// so raise an error
				if(!result[0]) return reject(new Error('NO_ROW_UPDATED'));
				else return resolve();
			}).catch(reject);
		})
	}

	// Delete data from the database selected from the given options
	public deleteData(options: Options): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			// Basic WhereOptions
			let whereOptions: s.WhereOptions = { plugin: this.pluginName };
			
			// Generate the "WhereOptions" object on the "data" column from the
			// options we got as parameter
			let data: s.WhereOptions | null = getDataWhereOptions(options);
			
			// Include conditions on the "data" column only if they exist
			if(data) whereOptions.data = data;
			
			this.model.data.destroy(<s.DestroyOptions>{ where: whereOptions })
			.then(() => resolve()).catch(reject);
		})
	}

	// Set the plugin state
	public setState(newState: State): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			this.model.plugin.update({
				state: State[newState] // Get the string from the given state
			}, <s.UpdateOptions>{
				where: <s.WhereOptions>{ dirname: this.pluginName }
			}).then(() => resolve(null)).catch(reject);
		})
	}

	// Get the current plugin state as a member of the State enum
	public getState(): Promise<State> {
		return new Promise<State>((resolve, reject) => {
			// The plugin's dirname is it's primary key
			this.model.plugin.findById(this.pluginName)
			.then((row) => {
				resolve(State[<string>row.get('state')]);
				return null;
			}).catch(reject); // If there's an error, catch it and send it
		})
	}
	
	// Returns the user's access level on the plugin as a member of the AccessLevel enum
	public getAccessLevel(username: string): Promise<AccessLevel> {
		return new Promise<AccessLevel>((resolve, reject) => {
			isAdmin(username, this.model.user)
			.then((admin) => {
				// If the user is admin on the platform, it gives it read/write
				// access to all plugins
				if(admin) return resolve(AccessLevel.readwrite);
				// If the user isn't admin, we check the access level relative
				// to the plugin
				return this.model.access.findOne(<s.FindOptions>{
					where: <s.WhereOptions>{
						plugin: this.pluginName,
						user: username
					}
				}).then((row) => {
					// Casting the level as a string, because else TypeScript
					// assumes it to be an integer, and the whole thing to 
					// return a string
					if(row) return resolve(AccessLevel[<string>row.get('level')]);
					else return resolve(AccessLevel.none);
				}).catch(reject);
			}).catch(reject);
		});
	}

	// Set access level on the plugin for a given user
	public setAccessLevel(username: string, level: AccessLevel): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			isAdmin(username, this.model.user)
			.then((admin) => {
				// If the user is admin on the platform, it gives it read/write
				// access to all plugins, so we can't change it
				// Sending the NOT_ADMIN error cause the current user (as all others)
				// isn't privileged enough to downgrade an admin's access
				if(admin) throw new Error('NOT_ADMIN');
				// If the user isn't admin, we check if there's an access level to
				// add or update
				return this.model.access.count(<s.CountOptions>{
					where: <s.WhereOptions>{
						plugin: this.pluginName,
						user: username
					}
				})
			})
			.then((count) => {
				// No row exists for this user: it has no access on the plugin.
				// Let's create one.
				if(!count) {
					// If the access level is "none", don't create a row
					if(level === AccessLevel.none) return Promise.resolve()
					return this.model.access.create(<s.CreateOptions>{
						plugin: this.pluginName,
						user: username,
						level: AccessLevel[level]
					});
				} else {
					// A row already exists, we update it or delete it.
					if(level === AccessLevel.none) {
						// Passing an access level to none means removing the
						// row from the database
						return this.model.access.destroy(<s.DestroyOptions>{
							where: <s.WhereOptions>{
								plugin: this.pluginName,
								user: username
							}
						});
					} else {
						// If the access level isn't "none", just update the row
						return this.model.access.update({
							level: AccessLevel[level]
						}, <s.UpdateOptions>{
							where: <s.WhereOptions> {
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
	public setHome(disableOld: boolean): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			// First check if the plugin exists
			SequelizeWrapper.getInstance().model('plugin').count(<s.CountOptions>{ 
				where: <s.WhereOptions>{ dirname: this.pluginName }
			})
			.then((count) => {
				if(!count) throw new Error('NO_PLUGIN'); // Plugin doesn't exist
				return this.removeHomeFlag(disableOld)
			})
			.then(() => this.setHomeFlag(this.pluginName))
			.then(() => {
				log.info('Set', this.pluginName, 'as the new home plugin');
				return resolve();					
			}).catch(reject)
		})
	}

	// PRIVATE

	// Removes the home flag of the current home plugin
	private removeHomeFlag(disableOld: boolean): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			let updatedValues = {
				home: false,
				state: State[State.enabled] // The previous home plugin is obviously enabled
			};
			// If the disableOld boolean is set to true, we disable the previous home plugin
			if(disableOld) updatedValues.state = State[State.disabled];
			SequelizeWrapper.getInstance().model('plugin').update(updatedValues, <s.UpdateOptions>{
				where: <s.WhereOptions>{ home: true }
			}).then(() => resolve()).catch(reject);
		})
	}
	
	// Set home flag to given plugin
	private setHomeFlag(pluginName: string): Promise<null> {
		return new Promise<null>((resolve, reject) => {
			SequelizeWrapper.getInstance().model('plugin').update({
				home: true,
				state: State[State.enabled] // Enable the new home plugin
			}, <s.UpdateOptions>{
				where: <s.WhereOptions>{ dirname: pluginName }
			}).then(() => resolve()).catch(reject);
		})
	}

	// Check if the provided metadata is valid agains the plugin schema
	private isSchemaValid(data: Data): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			// Check if a schema is defined first
			this.model.plugin.findById(this.pluginName).then((row) => {
				let schema = row.get('schema');
				if(schema && Object.keys(schema).length) {
					// Determining if the "meta" sub-object is required
					let required: boolean = false;
					for(let metadata in schema) {
						if(schema[metadata].required) required = true;
					}
					// Run the check only if at least one metadata is required
					if(data.meta && Object.keys(data.meta).length) {
						// Run the check
						if(revalidator.validate(data.meta, schema).valid) {
							return resolve(true);
						} else {
							return resolve(false);
						}
					} else if(!required) {
						// If no metadata are required, we don't care if there's a
						// "meta" sub-object or not
						return resolve(true);
					} else {
						return resolve(false); // No metadata where metadata was expected
					}
				} else {
					return resolve(true); // No schema in db: No need to check
				}
			}).catch(reject);
		})
	}
}

// INTERNAL

abstract class PluginInfos {
	name: string;
	description?: string;
	schema?: Object;
	home: boolean;
}

// Use a given Sequelize model to check if a user with a given username is admin
function isAdmin(username: string, model: s.Model<any,any>): Promise<boolean> {
	return new Promise<boolean>((resolve, reject) => {
		// Find user from its unique username
		model.findById(username).then((row) => {
			// If no user, well, no admin
			if(!row) return resolve(false);
			// Compare the role with the one we have in the Role enum
			return resolve(row.get('role').localeCompare(Role[Role.admin]) === 0);
		}).catch(reject); // Error handling
	});
}

// Generate a Sequelize WhereOptions instance if needed from the options
function getDataWhereOptions(options: Options): s.WhereOptions | null {
	let data: s.WhereOptions = <s.WhereOptions>{};

	// If no type nor timestamp has been given, we don't need a WhereOptions
	// object
	if(!options.type && ! options.startTimestamp) {
		return null;
	}
	
	// Check if type is provided
	if(options.type) {
		data.type = options.type;
	}
	// Check if starting timestamp is provided
	if(options.startTimestamp) {
		data.timestamp = <s.WhereOptions>{
			$lte: options.startTimestamp
		}
	}
	
	return data;
}