import {PluginConnector} from '../lib/plugins';

const args = process.argv.slice(2);

if(!args.length) {
	console.error('Please specify at least one plugin name');
	process.exit(1);
}

// JS script cause tsc messes up promises
let updates = args.map((name) => {
	return new Promise((resolve, reject) => {
		PluginConnector.updateSchema(name, (err) => {
			if(err) {
				return reject('Error while updating ' + name + ': ' + err.message);
			} else {
				return resolve(name);
			}
		});
	});
});

Promise.all(updates).then((names) => {
	for(let name in names) console.log('Schema updated for', names[name]);
	process.exit(0);
}).catch((err) => {
	console.error(err);
	process.exit(1);
});