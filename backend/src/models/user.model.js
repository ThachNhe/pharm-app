const { DataTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { roles } = require('../config/roles');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 128],
        isValidPassword(value) {
          if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
            throw new Error('Password must contain at least one letter and one number');
          }
        },
      },
    },
    role: {
      type: DataTypes.ENUM(...roles),
      defaultValue: 'user',
      validate: {
        isIn: [roles],
      },
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.setDataValue('password', await bcrypt.hash(user.password, 8));
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.setDataValue('password', await bcrypt.hash(user.password, 8));
        }
      },
    },
  }
);

User.prototype.isPasswordMatch = async function (password) {
  return bcrypt.compare(password, this.password);
};

User.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({
    where: {
      email,
      ...(excludeUserId && { id: { [Op.ne]: excludeUserId } }),
    },
  });
  return !!user;
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.createdAt;
  delete values.updatedAt;
  return values;
};

module.exports = User;
