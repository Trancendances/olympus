import * as sequelize from 'sequelize';

module.exports = <sequelize.DefineAttributes>{
	rule: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		primaryKey: true,
		allowNull: false
	},
	value: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		allowNull: false
	}
}