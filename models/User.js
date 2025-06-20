const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'supervisor', 'agent', 'readonly'),
      allowNull: false,
      defaultValue: 'agent',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login: {
      type: DataTypes.DATE,
    },
    password_reset_token: {
      type: DataTypes.STRING,
    },
    password_reset_expires: {
      type: DataTypes.DATE,
    },
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        theme: 'light',
        timezone: 'America/New_York',
        notifications: {
          email: true,
          browser: true,
          schedule_changes: true,
          shift_reminders: true,
        },
      },
    },
  }, {
    indexes: [
      {
        fields: ['username'],
      },
      {
        fields: ['email'],
      },
      {
        fields: ['role'],
      },
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      },
    },
  });

  // Instance methods
  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password_hash);
  };

  User.prototype.getFullName = function() {
    return `${this.first_name} ${this.last_name}`;
  };

  User.prototype.hasRole = function(role) {
    const roleHierarchy = {
      admin: 5,
      manager: 4,
      supervisor: 3,
      agent: 2,
      readonly: 1,
    };
    
    return roleHierarchy[this.role] >= roleHierarchy[role];
  };

  User.prototype.canManageAgent = function(agentUserId) {
    return this.hasRole('supervisor') || this.id === agentUserId;
  };

  return User;
}; 