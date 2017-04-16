import * as s from 'sequelize';

const printit = require('printit');

// Load the configuration
const path = require('path');
const config = require(path.resolve('.') + '/settings').database;

// Load Sequelize module
const Sequelize: s.SequelizeStatic	= require('sequelize');

// Wrapper to singleton-ise Sequelize
class SequelizeWrapper {
	private static instance: s.Sequelize;
	private static sync: boolean = false;

	public static getInstance() {
		if(!this.instance) {
			let instance: s.Sequelize = new Sequelize(config.database, config.user, config.password, <s.Options>{
				host: config.host,
				port: config.port,
				dialect: 'postgres',
				logging: false,
				define: <s.DefineOptions<any>>{
					timestamps: false
				}
			});
			
			// Load and define Sequelize models
			instance.define('core_config', require('../models/coreConfig'), { freezeTableName: true });
			instance.define('user', require('../models/user'), { freezeTableName: true });
			instance.define('plugin', require('../models/plugin'), { freezeTableName: true });
			instance.define('plugin_data', require('../models/pluginData'), { freezeTableName: true });
			instance.define('plugin_access', require('../models/pluginAccess'), { freezeTableName: true });
			
			// Create the tables if they don't already exist
			
			this.instance = instance;
		}

		return this.instance;
	}

	// Will only be called by the sync script
	public static syncModels(params?: s.SyncOptions) {
		this.instance.sync(params).then(() => {
			console.info('Database synchronised');
			this.sync = true;
			process.exit(0);
		}).catch((err) => {
			console.error(err);
			process.exit(1);
		});
	}
	
	public static isSync() {
		return this.sync;
	}
}

module.exports = SequelizeWrapper;