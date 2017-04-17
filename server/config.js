var americano   = require('americano'),
    fs          = require('fs'),
    path        = require('path');

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
// TODO: Check if [plugin]/public exists
for(plugin of plugins) {
    let pluginPublicPath = path.join(root, plugin, 'public');
    let pluginSlug = require(path.join(root, plugin, 'package.json')).name;
    
    config.common.use.push([
        '/' + pluginSlug,
        americano.static(pluginPublicPath, {
            maxAge: 86400000
        })
    ]);
}

module.exports = config;