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
        onUpdate: 'CASCADE',
        allowNull: false
    },
    user: {
        type: sequelize.TEXT,
        primaryKey: true,
        references: {
            model: 'user',
            key: 'username'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        allowNull: false
    },
    level: {
        type: sequelize.ENUM('readonly', 'readwrite'),
        allowNull: false
    }
};
