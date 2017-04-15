import * as s from 'sequelize';

const sequelizeWrapper = require('../utils/sequelizeWrapper');

// Data models for plugin's data and metadata

export abstract class Data {
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

		// Check if the status is in the correct format
		if(['draft', 'unlisted', 'published'].indexOf(data.status) < 0) {
			return false;
		}

		return true;
	}
}

export abstract class MetaData {
	[property: string]: any;
}

// Data model for query option

export abstract class Options {
	type?: string;
	number: number;
	startTimestamp?: number;
}

// Enumerations used in the database

export enum State {
	uninstalled,
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
			access: sequelizeWrapper.getInstance().model('plugin_access'),
			data: sequelizeWrapper.getInstance().model('plugin_data'),
			plugin: sequelizeWrapper.getInstance().model('plugin'),
			user: sequelizeWrapper.getInstance().model('user')
		}
	}

	// Get a singleton-ised instance of the connector corresponding to the plugin
	// TODO: Check if the plugin exists
	public static getInstance(pluginName: string) {
		if(!this.instances) {
			this.instances = {}; // Initialisation to empty object
		}
		if(!this.instances[pluginName]) {
			this.instances[pluginName] = new PluginConnector(pluginName);
		}
		return this.instances[pluginName];
	}

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
			// Create the database entry
			this.model.data.create(<s.CreateOptions>{
				plugin: this.pluginName,
				data: data
			}).then(() => { next(null) }) // No result
			.catch(next); // If there's an error, catch it and send it
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

		this.model.data.update({ data: newData }, <s.UpdateOptions>{
			where: <s.WhereOptions> {
				plugin: this.pluginName,
				data: oldData
			}
		}).then((result) => {
			// If no row were updated, it means we got the original data wrong
			// so raise an error
			if(!result[0]) next(new Error('NO_ROW_UPDATED'));
			else next(null);
		}).catch(next);
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
		}).then(() => { next(null); })
		.catch(next);
	}

	// Set the plugin state
	public setState(newState: State, next:(err: Error | null) => void) {
		this.model.plugin.update({
			state: State[newState] // Get the string from the given state
		}, <s.UpdateOptions>{
			where: <s.WhereOptions>{ dirname: this.pluginName }
		}).then(() => { next(null) })
		.catch(next);
	}

	// Get the current plugin state as a member of the State enum
	public getState(next: (err: Error | null, state?: State) => void) {
		// The plugin's dirname is it's primary key
		this.model.plugin.findById(this.pluginName)
		.then((row) => { next(null, State[<string>row.get('state')]); })
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
				if(row) next(null, AccessLevel[<string>row.get('level')]);
				else next(null, AccessLevel.none);
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
					this.model.access.create(<s.CreateOptions>{
						plugin: this.pluginName,
						user: username,
						level: AccessLevel[level]
					}).then(() => { next(null) })
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
						}).then(() => { next(null); })
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
						}).then(() => { next(null); })
						.catch(next);
					}
				}
			});
		});
	}
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