const { Sequelize } = require('sequelize');
const path = require('path');

// Database configuration - PostgreSQL for production, SQLite for development
const sequelize = process.env.NODE_ENV === 'production' ? 
  new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'workforce_management',
    username: process.env.DB_USER || 'wfm_user',
    password: process.env.DB_PASSWORD || 'secure_password_123',
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
    },
  }) :
  new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
    },
  });

// Import models
const Agent = require('./Agent')(sequelize);
const Skill = require('./Skill')(sequelize);
const Channel = require('./Channel')(sequelize);
const Schedule = require('./Schedule')(sequelize);
const Shift = require('./Shift')(sequelize);
const TimeOff = require('./TimeOff')(sequelize);
const Forecast = require('./Forecast')(sequelize);
const Adherence = require('./Adherence')(sequelize);
const User = require('./User')(sequelize);

// Define associations
Agent.belongsToMany(Skill, { through: 'AgentSkills' });
Skill.belongsToMany(Agent, { through: 'AgentSkills' });

Agent.belongsToMany(Channel, { through: 'AgentChannels' });
Channel.belongsToMany(Agent, { through: 'AgentChannels' });

Agent.hasMany(Schedule);
Schedule.belongsTo(Agent);

Agent.hasMany(Shift);
Shift.belongsTo(Agent);

Agent.hasMany(TimeOff);
TimeOff.belongsTo(Agent);

Agent.hasMany(Adherence);
Adherence.belongsTo(Agent);

Schedule.hasMany(Shift);
Shift.belongsTo(Schedule);

Channel.hasMany(Forecast);
Forecast.belongsTo(Channel);

Channel.hasMany(Shift);
Shift.belongsTo(Channel);

Skill.hasMany(Forecast);
Forecast.belongsTo(Skill);

// User authentication
User.hasOne(Agent);
Agent.belongsTo(User);

module.exports = {
  sequelize,
  Agent,
  Skill,
  Channel,
  Schedule,
  Shift,
  TimeOff,
  Forecast,
  Adherence,
  User,
}; 