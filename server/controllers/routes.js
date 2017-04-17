const data      = require('./pluginData');
const plugin    = require('./plugin');
const admin     = require('./admin');

module.exports = {
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