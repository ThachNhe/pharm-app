const { sequelize } = require('../config/database');
const User = require('./user.model');
const Token = require('./token.model');

// Define associations
Token.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
User.hasMany(Token, { foreignKey: 'userId', as: 'tokens', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

module.exports = {
  sequelize,
  User,
  Token,
};
