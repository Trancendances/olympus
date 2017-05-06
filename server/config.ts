import * as p from './lib/plugins';
import * as passport from 'passport';
import {passportConfig} from './utils/passportConfig'

var americano       = require('americano'),
    fs              = require('fs'),
    path            = require('path');

var root = path.resolve('./plugins');

var config = {
    common: {
        use: [
            passport.initialize(),
            americano.bodyParser.urlencoded({ extended: false }),
            americano.bodyParser.json(),            
            americano.methodOverride(),
            americano.static(__dirname + '/../../client/public', {
                maxAge: 86400000
            })
        ],
        useAfter: [
            americano.errorHandler({
                dumpExceptions: true,
                showStack: true
            }),
        ]
    },
    development: [
        americano.logger('dev')
    ],
    production: [
        americano.logger('short')
    ]
};

// Configure passport
passportConfig();

// Check and update plugins currently stored in the database
p.PluginConnector.update((err) => {
    if(err) {
        console.error(err);
        process.exit(1);
    }
});

// Retrieve a list of the plugins currently present in the /plugins directory
var plugins = fs.readdirSync(root).filter(file => fs.statSync(path.join(root, file)).isDirectory());

// Add plugin's public directories as static routes
for(let plugin of plugins) {
    // Get instance of the connector so the plugin gets registered if
    // it wasn't before
    p.PluginConnector.getInstance(plugin, (err, connector) => {
        if(err) return console.error(err);
        if(!connector) {
            console.error(new Error('Couldn\'t get database connector'));
            return process.exit(1);
        }

        connector.getState((err, state) => {
            if(err) {
                console.error(err);
                return process.exit(1);
            }
            // Only create the root if the plugin is enabled
            if(state === p.State.enabled) {
                // Get the plugin's public path
                let pluginPublicPath = path.join(root, plugin, 'public');
                
                // Check if the plugin has a public directory
                if(fs.existsSync(pluginPublicPath)) {
                    // Create a static route for the plugin
                    config.common.use.push([
                        '/' + plugin,
                        americano.static(pluginPublicPath, {
                            maxAge: 86400000
                        })
                    ]);
                }
            }
        });
    });
}

module.exports = config;