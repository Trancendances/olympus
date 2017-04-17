var americano       = require('americano'),
    fs              = require('fs'),
    path            = require('path'),
    pluginConnector = require('./lib/plugins').PluginConnector;

var root = path.resolve('./plugins');

var config = {
    common: {
        use: [
            americano.bodyParser(),
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

var plugins = fs.readdirSync(root).filter(file => fs.statSync(path.join(root, file)).isDirectory());

// Add plugin's public directories as static routes
for(let plugin of plugins) {
    // Get (unused) instance of the connector so the plugin gets registered if
    // it wasn't before
    pluginConnector.getInstance(plugin, (err) => {
        if(err) return console.error(err);
    });
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

module.exports = config;