"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize = require("sequelize");
module.exports = {
    dirname: {
        type: sequelize.TEXT,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: sequelize.TEXT,
        allowNull: false
    },
    description: sequelize.TEXT,
    schema: sequelize.JSONB,
    state: {
        type: sequelize.ENUM('uninstalled', 'disabled', 'enabled'),
        allowNull: false
    },
    home: {
        type: sequelize.BOOLEAN,
        allowNull: false
    }
};
