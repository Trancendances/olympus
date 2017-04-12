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
	state: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.ENUM('uninstalled', 'disabled', 'enabled'),
		allowNull: false
	}
}