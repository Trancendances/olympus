"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const Plugins = require("../lib/plugins");
const log = require('printit')({
    date: true,
    prefix: 'Plugins'
});
const root = path.resolve('./plugins');
function loadPlugins(server) {
    // Check and update plugins currently stored in the database
    Plugins.PluginConnector.update().catch(processError);
    // Retrieve a list of the plugins currently present in the /plugins directory
    let plugins = fs.readdirSync(root).filter(file => fs.statSync(path.join(root, file)).isDirectory());
    // Add plugin's public directories as static routes
    for (let plugin of plugins) {
        // Get instance of the connector so the plugin gets registered if
        // it wasn't before
        Plugins.PluginConnector.getInstance(plugin)
            .then((connector) => {
            if (!connector)
                throw new Error('Couldn\'t get database connector');
            return connector.getState();
        }).then((state) => {
            // Only create the root if the plugin is enabled
            if (state === Plugins.State.enabled) {
                // Get the plugin's public path
                let pluginPublicPath = path.join(root, plugin, 'public');
                // Check if the plugin has a public directory
                if (fs.existsSync(pluginPublicPath)) {
                    // Create a static route for the plugin
                    server.route({
                        method: 'GET',
                        path: '/' + plugin + '/{file*}',
                        handler: { directory: {
                                path: __dirname + pluginPublicPath,
                                listing: true
                            } }
                    });
                }
            }
        }).catch(processError);
    }
}
exports.loadPlugins = loadPlugins;
function processError(e) {
    log.error(e);
    process.exit(1);
}
