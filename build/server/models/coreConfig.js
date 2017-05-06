"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize = require("sequelize");
module.exports = {
    rule: {
        type: sequelize.TEXT,
        primaryKey: true,
        allowNull: false
    },
    value: {
        type: sequelize.TEXT,
        allowNull: false
    }
};
