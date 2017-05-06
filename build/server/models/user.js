"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize = require("sequelize");
module.exports = {
    username: {
        type: sequelize.TEXT,
        primaryKey: true,
        allowNull: false
    },
    email: {
        type: sequelize.TEXT,
        allowNull: false
    },
    displayedname: {
        type: sequelize.TEXT,
        allowNull: false
    },
    passwordhash: {
        type: sequelize.TEXT,
        allowNull: false
    },
    salt: {
        type: sequelize.TEXT,
        allowNull: false
    },
    role: {
        type: sequelize.ENUM('admin', 'editor', 'reader'),
        allowNull: false
    }
};
