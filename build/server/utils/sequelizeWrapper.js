"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const printit = require('printit');
// Load the configuration
const path = require('path');
const config = require(path.resolve('.') + '/settings').database;
// Load Sequelize module
const Sequelize = require('sequelize');
// Wrapper to singleton-ise Sequelize
class SequelizeWrapper {
    static getInstance() {
        if (!this.instance) {
            let instance = new Sequelize(config.database, config.user, config.password, {
                host: config.host,
                port: config.port,
                dialect: 'postgres',
                logging: false,
                define: {
                    timestamps: false
                }
            });
            // Load and define Sequelize models
            instance.define('core_config', require('../models/coreConfig'), { freezeTableName: true });
            instance.define('user', require('../models/user'), { freezeTableName: true });
            instance.define('plugin', require('../models/plugin'), { freezeTableName: true });
            instance.define('plugin_data', require('../models/pluginData'), { freezeTableName: true });
            instance.define('plugin_access', require('../models/pluginAccess'), { freezeTableName: true });
            this.instance = instance;
        }
        return this.instance;
    }
    // Will only be called by the sync script
    static syncModels(params) {
        this.instance.sync(params).then(() => {
            console.info('Database synchronised');
            this.sync = true;
            process.exit(0); // Exit because else Sequelize will keep the process running
        }).catch((err) => {
            console.error(err);
            process.exit(1);
        });
    }
    static isSync() {
        return this.sync;
    }
}
SequelizeWrapper.sync = false;
exports.SequelizeWrapper = SequelizeWrapper;
