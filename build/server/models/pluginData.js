"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize = require("sequelize");
module.exports = {
    plugin: {
        type: sequelize.TEXT,
        primaryKey: true,
        references: {
            model: 'plugin',
            key: 'dirname'
        },
        onUpdate: 'CASCADE'
    },
    data: {
        type: sequelize.JSONB,
        primaryKey: true,
        allowNull: false
    }
};
