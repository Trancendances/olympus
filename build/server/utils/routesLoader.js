"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log = require('printit')({
    date: true,
    prefix: 'Router'
});
const routes = require('../router');
function loadRoutes(server) {
    for (let path in routes) {
        let methods = routes[path];
        for (let method in methods) {
            let handler = methods[method];
            let route = {
                method: method,
                path: path,
                handler: methods[method].handler,
                config: methods[method].infos
            };
            route.config.tags = ['api'];
            delete route.config.handler;
            // Rewrote description properties' names for better clarity
            route.config.notes = route.config.description;
            route.config.description = route.config.title;
            delete route.config.title;
            server.route(route);
            log.debug('Loaded route ' + method.toUpperCase() + ' ' + path);
        }
    }
    log.info('Routes loaded');
}
exports.loadRoutes = loadRoutes;
