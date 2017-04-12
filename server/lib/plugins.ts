import * as s from 'sequelize';

const sequelizeWrapper = require('../utils/sequelizeWrapper');

// Data models for plugin's data and metadata

export abstract class Data {
	type: string;
	timestamp: number;
	name: string;
	content: string;
	meta: MetaData
}

export abstract class MetaData {
	[property: string]: string | number;
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
	readonly,
	readwrite
}

export class PluginConnector {
	private readonly pool;
	private readonly model: {
		plugin: s.Model<any,any>,
		access: s.Model<any,any>,
		data: s.Model<any,any>
	};
	private static instances: {
		[pluginName: string]: PluginConnector;
	};
	
	private constructor(private readonly pluginName: string) {
		this.model = {
			plugin: sequelizeWrapper.getInstance().model('plugin'),
			access: sequelizeWrapper.getInstance().model('plugin_access'),
			data: sequelizeWrapper.getInstance().model('plugin_data')
		}
	}
	
	public static getInstance(pluginName: string) {
		if(!this.instances) {
			this.instances = {}; // Initialisation to empty object
		}
		if(!this.instances[pluginName]) {
			this.instances[pluginName] = new PluginConnector(pluginName);
		}
		return this.instances[pluginName];
	}

	public getData(options: Options, next:(err: Error | null, data?: Data[]) => void) {
		// We only run the query if the database has been synchronised
		if(sequelizeWrapper.isSync()) {
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
				next(null, result);
			}).catch(next); // If there's an error, catch it and send it
		}
	}
	
	// TODO
	public addData(data: Data, next:(err: Error | null, data?: Data) => void) {}
	
	// TODO
	public updateData(oldData: Data, newData: Data, next:(err: Error | null, data?: Data) => void) {}

	// Prototypes for method overload
	public deleteData(data: Data, next:(err: Error | null) => void): void;
	public deleteData(options: Options, next:(err: Error | null) => void): void;

	public deleteData(arg: Data | Options, next:(err: Error | null) => void) {
		if(arg instanceof Data) this.deleteElement(arg, next);
		if(arg instanceof Options) this.deleteRange(arg, next);
	}

	// TODO
	private deleteElement(element: Data, next:(err: Error | null) => void) {}
	private deleteRange(options: Options, next:(err: Error | null) => void) {}

	// TODO
	public changeState(newState: State, next:(err: Error | null) => void) {}
	
	public getState(next: (err: Error | null, state?: State) => void) {
		// We only run the query if the database has been synchronised
		if(sequelizeWrapper.isSync()) {
			// We know from the database's constraints that there is only one
			// row for a given plugin's dirname
			this.model.plugin.findOne(<s.FindOptions>{
				where: <s.WhereOptions>{ dirname: this.pluginName }
			}).then((row) => {
				// Only send the state
				next(null, <State>row.get('state'));
			}).catch(next); // If there's an error, catch it and send it
		}
	}
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
			$lt: options.startTimestamp
		}
	}
	
	return data;
}