const data      = require('./pluginData');
const plugin    = require('./plugin');
const admin     = require('./admin');
const user      = require('./user');

const passport  = require('passport');

module.exports = {
    'auth': {
        post: user.auth
    },
    'auth/:user': {
        get: user.get,
        post: user.add,
        put: user.update,
        delete: user.delete
    },
    'api/plugins': {
        get: plugin.getList
    },
    'api/home': {
        get: plugin.home,
        post: admin.home
    },
    'api/:plugin/data': { // Plugins' data
        get: data.get,
        post: data.add,
        put: data.replace,
        delete: data.delete
    },
    'api/:plugin/state': { // Plugins' state
        get: plugin.state,
        put: admin.changeState // Only admin can edit a plugin's state
    },
    'api/:plugin/access': { // Get a user's access level to a plugin
        post: admin.setAccessLevel
    }
};