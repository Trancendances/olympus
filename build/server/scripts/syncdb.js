"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelizeWrapper_1 = require("../utils/sequelizeWrapper");
const options = {
    '--force': {
        key: 'force',
        value: true
    }
};
const args = process.argv.slice(2);
let syncOptions = {};
for (let i in args) {
    let arg = args[i];
    if (Object.keys(options).indexOf(arg) < 0) {
        console.error('Unknown argument:', arg);
        process.exit(1);
    }
    syncOptions[options[arg].key] = options[arg].value;
}
sequelizeWrapper_1.SequelizeWrapper.getInstance(); // Create an instance
sequelizeWrapper_1.SequelizeWrapper.syncModels(syncOptions);
