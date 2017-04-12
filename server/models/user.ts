import * as sequelize from 'sequelize';

module.exports = <sequelize.DefineAttributes>{
	username: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		primaryKey: true,
		allowNull: false
	},
	displayedname: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		allowNull: false
	},
	passwordhash: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		allowNull: false
	},
	salt: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.TEXT,
		allowNull: false
	},
	role: <sequelize.DefineAttributeColumnOptions>{
		type: sequelize.ENUM('admin', 'editor', 'reader'),
		allowNull: false
	}
}