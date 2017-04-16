import {SyncOptions} from 'sequelize';

const wrapper = require('../utils/sequelizeWrapper');

const options = {
	'--force': {
		key: 'force',
		value: true
	}
}

const args = process.argv.slice(2);

let syncOptions: SyncOptions = {};

for(let i in args) {
	let arg: string = args[i];
	if(Object.keys(options).indexOf(arg) < 0) {
		console.error('Unknown argument:', arg);
		process.exit(1);
	}
	syncOptions[options[arg].key] = options[arg].value;
}

wrapper.getInstance(); // Create an instance
wrapper.syncModels(syncOptions);