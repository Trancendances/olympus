import * as sequelize from 'sequelize';

module.exports = <sequelize.DefineAttributes>{
	plugin: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		primaryKey: true,
		references: {
			model: 'plugin',
			key: 'dirname'
		},
		onUpdate: 'CASCADE'
	},
	data: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.JSONB,
		primaryKey: true,
		allowNull: false
	}
}