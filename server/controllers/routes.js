const data      = require('./pluginData');
const plugin    = require('./plugin');
const admin     = require('./admin');

module.exports = {
    'api/:plugin/data': { // Plugins' data
        get: data.get,
        post: data.add,
        put: data.replace,
        delete: data.delete
    },
    'api/:plugin/state': { // Plugins' state
        get: plugin.state,
        put: admin.updateState // Only admin can edit a plugin's state
    },
    'api/:plugin/access': { // Get a user's access level to a plugin
        post: admin.setAccessLevel
    }
};