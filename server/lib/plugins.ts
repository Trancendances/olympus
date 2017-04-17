import * as s from 'sequelize';
import {SequelizeWrapper} from '../utils/sequelizeWrapper';

const path				= require('path');
const revalidator		= require('revalidator');
const printit			= require('printit');
const log = printit({
	date: true,
	prefix: 'PluginConnector'
})

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
	disabled,
	enabled
}

export enum AccessLevel {
	none,
	readonly,
	readwrite
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
	public static getInstance(pluginName: string, next:(err: Error | null, instance?: PluginConnector) => void) {
		if(!this.instances) {
			this.instances = {}; // Initialisation to empty object
		}
		if(!this.instances[pluginName]) {
			SequelizeWrapper.getInstance().model('plugin').count(<s.CountOptions>{ 
				where: <s.WhereOptions>{ dirname: pluginName }
			}).then((count) => {
				this.instances[pluginName] = new PluginConnector(pluginName);
				if(!count) {
					this.register(pluginName, (err) => {
						if(err) return next(err);
						return next(null, this.instances[pluginName]);
					});
				} else {
					return next(null, this.instances[pluginName]);
				}
			});
		} else {
			return next(null, this.instances[pluginName]);
		}
	}

	// Updates schema of a given plugin based on the info in its manifest
	public static updateSchema(pluginName: string, next: (err: Error | null) => void): void {
		try {
			// Get plugin info from its manifest
			let infos: PluginInfos = this.getPluginInfos(pluginName);
			// Update the schema
			SequelizeWrapper.getInstance().model('plugin').update({
				schema: infos.schema
			}, <s.UpdateOptions>{
				where: <s.WhereOptions>{ dirname: pluginName }
			}).then(() => { return next(null); })
			.catch(next);
		} catch(e) {
			// We may get an error when trying to open a non-existing manifest
			next(e);
		}
	}

	// Move the home flag to the given plugin
	public static setHome(pluginName: string, next:(err: Error | null) => void) {
		// First check if the plugin exists
		SequelizeWrapper.getInstance().model('plugin').count(<s.CountOptions>{ 
			where: <s.WhereOptions>{ dirname: pluginName }
		}).then((count) => {
			if(!count) return next(new Error('NO_PLUGIN')); // Plugin doesn't exist
			this.removeHomeFlag((err) => {
				if(err) return next(err);
				this.setHomeFlag(pluginName, (err) => {
					if(err) return next(err);
					return next(null);
				});
			});
		}).catch(next);
	}

	// If the plugin doesn't exist, getInstance will register it in the database
	private static register(pluginName: string, next:(err: Error | null) => void) {
		try {
			let infos: PluginInfos = this.getPluginInfos(pluginName);
			let schema;
			// Check if schema is defined
			if(infos.schema) {
				// If it is, format it so revalidator can use it
				schema = infos.schema;
			} else {
				// Else, set it to null
				schema = null;
			}
			// We don't need to count the rows, as getInstance already does it before
			SequelizeWrapper.getInstance().model('plugin').create({
				dirname: pluginName,
				name: infos.name,
				description: infos.description || null,
				schema: schema,
				state: State[State.disabled],
				home: this.isHome(pluginName)
			}).then(() => {
				log.info('Registered new plugin', pluginName);
				return next(null);
			})
			.catch(next);
		} catch(e) {
			return next(e);
		}
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

	// Removes the home flag of the current home plugin
	private static removeHomeFlag(next:(err: Error | null) => void) {
		SequelizeWrapper.getInstance().model('plugin').update({
			home: false
		}, <s.UpdateOptions>{
			where: <s.WhereOptions>{ home: true }
		}).then(() => { return next(null); })
		.catch(next);
	}

	// Set home flag to given plugin
	private static setHomeFlag(pluginName: string, next:(err: Error | null) => void) {
		SequelizeWrapper.getInstance().model('plugin').update({
			home: true
		}, <s.UpdateOptions>{
			where: <s.WhereOptions>{ dirname: pluginName }
		}).then(() => { return next(null); })
		.catch(next);
	}

	// PUBLIC

	// Retrieve data from the database using given filters
	public getData(options: Options, next:(err: Error | null, data?: Data[]) => void) {
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
			return next(null, result);
		}).catch(next); // If there's an error, catch it and send it
	}

	// Save the given data in the database
	public addData(data: Data, next:(err: Error | null) => void) {
		if(!data.timestamp) {
			// The timestamp will be the data's unique identifier, so
			// we need it
			return next(new Error('TIMESTAMP_MISSING'));
		}

		this.model.data.count(<s.CountOptions>{ 
			where: <s.WhereOptions>{
				plugin: this.pluginName,
				data: { timestamp: data.timestamp }
			}
		}).then((count) => {
			// A timestamp must be unique as it is how we'll be identifying data
			// for the plugin
			if(count) return next(new Error('TIMESTAMP_EXISTS'));
			// Now check if the "meta" object respects the plugin schema if exists
			return this.isSchemaValid(data, (err, valid) => {
				if(err) return next(err);
				if(valid) {
					// Create the database entry
					this.model.data.create(<s.CreateOptions>{
						plugin: this.pluginName,
						data: data
					}).then(() => { return next(null) }) // No result
					.catch(next); // If there's an error, catch it and send it
				} else {
					return next(new Error('METADATA_MISMATCH'))
				}
			});
		});
	}
	
	// Update a data row in the database. The old row is fully replaced by the new one
	// so any missing data is removed
	public replaceData(oldData: Data, newData: Data, next:(err: Error | null) => void) {
		if(!newData.timestamp) {
			// The timestamp will be the data's unique identifier, so
			// we need it
			return next(new Error('TIMESTAMP_MISSING'));
		}

		// Now check if the "meta" object respects the plugin schema if exists
		this.isSchemaValid(newData, (err, valid) => {
			if(err) return next(err);
			if(valid) {
				// Replace the database entry
				this.model.data.update({ data: newData }, <s.UpdateOptions>{
					where: <s.WhereOptions> {
						plugin: this.pluginName,
						data: oldData
					}
				}).then((result) => {
					// If no row were updated, it means we got the original data wrong
					// so raise an error
					if(!result[0]) return next(new Error('NO_ROW_UPDATED'));
					else return next(null);
				}).catch(next);
			} else {
				return next(new Error('METADATA_MISMATCH'))
			}
		});
	}

	// Delete data from the database selected from the given options
	public deleteData(options: Options, next:(err: Error | null) => void) {
		// Basic WhereOptions
		let whereOptions: s.WhereOptions = { plugin: this.pluginName };

		// Generate the "WhereOptions" object on the "data" column from the
		// options we got as parameter
		let data: s.WhereOptions | null = getDataWhereOptions(options);

		// Include conditions on the "data" column only if they exist
		if(data) whereOptions.data = data;

		this.model.data.destroy(<s.DestroyOptions>{
			where: whereOptions
		}).then(() => { return next(null); })
		.catch(next);
	}

	// Set the plugin state
	public setState(newState: State, next:(err: Error | null) => void) {
		this.model.plugin.update({
			state: State[newState] // Get the string from the given state
		}, <s.UpdateOptions>{
			where: <s.WhereOptions>{ dirname: this.pluginName }
		}).then(() => { return next(null) })
		.catch(next);
	}

	// Get the current plugin state as a member of the State enum
	public getState(next: (err: Error | null, state?: State) => void) {
		// The plugin's dirname is it's primary key
		this.model.plugin.findById(this.pluginName)
		.then((row) => { return next(null, State[<string>row.get('state')]); })
		.catch(next); // If there's an error, catch it and send it
	}
	
	// Returns the user's access level on the plugin as a member of the AccessLevel enum
	public getAccessLevel(username: string, next:(err: Error | null, level?: AccessLevel) => void) {
		isAdmin(username, this.model.user, (err, admin) => {
			if(err) return next(err);
			// If the user is admin on the platform, it gives it read/write
			// access to all plugins
			if(admin) return next(null, AccessLevel.readwrite);
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
				if(row) return next(null, AccessLevel[<string>row.get('level')]);
				else return next(null, AccessLevel.none);
			}).catch(next);
		})
	}

	// Set access level on the plugin for a given user
	public setAccessLevel(username: string, level: AccessLevel, next:(err: Error | null) => void) {
		isAdmin(username, this.model.user, (err, admin) => {
			if(err) return next(err);
			// If the user is admin on the platform, it gives it read/write
			// access to all plugins, so we can't change it
			if(admin) return next(new Error('IS_ADMIN'));
			// If the user isn't admin, we check if there's an access level to
			// add or update
			this.model.access.count(<s.CountOptions>{
				where: <s.WhereOptions>{
					plugin: this.pluginName,
					user: username
				}
			}).then((count) => {
				// No row exists for this user: it has no access on the plugin.
				// Let's create one.
				if(!count) {
					// If the access level is "none", don't create a row
					if(level === AccessLevel.none) next(null)
					return this.model.access.create(<s.CreateOptions>{
						plugin: this.pluginName,
						user: username,
						level: AccessLevel[level]
					}).then(() => { return next(null) })
					.catch(next);
				} else {
					// A row already exists, we update it or delete it.
					if(level === AccessLevel.none) {
						// Passing an access level to none means removing the
						// row from the database
						this.model.access.destroy(<s.DestroyOptions>{
							where: <s.WhereOptions>{
								plugin: this.pluginName,
								user: username
							}
						}).then(() => { return next(null); })
						.catch(next);
					} else {
						// If the access level isn't "none", just update the row
						this.model.access.update({
							level: AccessLevel[level]
						}, <s.UpdateOptions>{
							where: <s.WhereOptions> {
								plugin: this.pluginName,
								user: username
							}
						}).then(() => { return next(null); })
						.catch(next);
					}
				}
			});
		});
	}

	// PRIVATE


	// Check if the provided metadata is valid agains the plugin schema
	private isSchemaValid(data: Data, next:(err: Error | null, valid?: boolean) => void) {
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
						return next(null, true);
					} else {
						return next(null, false);
					}
				} else if(!required) {
					// If no metadata are required, we don't care if there's a
					// "meta" sub-object or not
					return next(null, true);
				} else {
					return next(null, false); // No metadata where metadata was expected
				}
			} else {
				return next(null, true); // No schema in db: No need to check
			}
		}).catch(next);
	}
}

// INTERNAL

abstract class PluginInfos {
	name: string;
	description?: string;
	schema?: Object;
	home: boolean;
}

// We don't need to export this one: the plugin doesn't need to know the user's
// global role
enum Role {
	reader,
	admin,
	editor
}

// Use a given Sequelize model to check if a user with a given username is admin
function isAdmin(username: string, model: s.Model<any,any>, next:(err: Error | null, admin?: boolean) => void): void {
	// Find user from its unique username
    model.findById(username).then((row) => {
		// If no user, well, no admin
		if(!row) return next(null, false);
		// Compare the role with the one we have in the Role enum
		if(row.get('role') === Role[Role.admin]) return next(null, true);
		// If it doesn't match, no admin
		return next(null, false);
	}).catch(next); // Error handling
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