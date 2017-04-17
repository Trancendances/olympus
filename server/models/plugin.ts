import * as sequelize from 'sequelize';

module.exports = <sequelize.DefineAttributes>{
	dirname: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		primaryKey: true,
		allowNull: false
	},
	name: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		allowNull: false
	},
	description: sequelize.TEXT,
	schema: sequelize.JSONB,
	state: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.ENUM('uninstalled', 'disabled', 'enabled'),
		allowNull: false
	},
	home: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.BOOLEAN,
		allowNull: false
	}
}