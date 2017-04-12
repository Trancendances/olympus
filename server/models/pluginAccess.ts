import * as sequelize from 'sequelize';

module.exports = <sequelize.DefineAttributes>{
	plugin: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		primaryKey: true,
		references: {
			model: 'plugin',
			key: 'dirname'
		},
		allowNull: false
	},
	user: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		primaryKey: true,
		references: {
			model: 'user',
			key: 'username'
		},
		allowNull: false
	},
	level: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.ENUM('readonly', 'readwrite'),
		allowNull: false
	}
}