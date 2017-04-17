import {PluginConnector} from '../lib/plugins';

const args = process.argv.slice(2);

function displayHelp(): void {
	console.log('Usage: npm run sethome -- [OPTIONS]\n');
	console.log('Options:');
	console.log('  --plugin PLUGIN\tSets PLUGIN as the new home plugin');
	console.log('  --disable-previous\tDisables the previous home plugin (warning: if not used, the previous home plugin will stay enabled)');
	console.log('  --from-settings\tUses the plugin set in the settings.json file instead of the one provided as command line argument')
}

if(!args.length) {
	displayHelp();
	process.exit(1);
}

let name = args[0];
let disableOld = false;

let fromSettings = false;

for(var i = 0; i < args.length; i++) {
	let arg = args[i];
	switch(arg) {
		case '--plugin':
			i++;
			name = args[i];
			break
		case '--disable-previous':
			disableOld = true;
			break;
		case '--from-settings':
			name = require('./settings').home;
			fromSettings = true;
			break;
		case '--help':
		default:
			displayHelp();
			process.exit(0);
	}
}

PluginConnector.getInstance(name, (err, connector) => {
	if(!connector) return console.error('Couldn\'t get database connector');
	connector.setHome(false, (err) => {
		if(err) {
			console.error('Error when setting home plugin to ' + name + ':', err.message);
			process.exit(1);
		}
		console.log('Home set to plugin', name);
	});
});