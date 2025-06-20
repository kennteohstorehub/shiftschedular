const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Agent = sequelize.define('Agent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    employee_id: {
      type: DataTypes.STRING,
      unique: true,
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
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
    },
    hire_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'on_leave', 'terminated'),
      defaultValue: 'active',
    },
    employment_type: {
      type: DataTypes.ENUM('full_time', 'part_time', 'contractor'),
      defaultValue: 'full_time',
    },
    shift_pattern: {
      type: DataTypes.ENUM('fixed', 'rotating', 'flexible'),
      defaultValue: 'flexible',
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'America/New_York',
    },
    // Performance metrics
    average_handle_time: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Average handle time in minutes',
    },
    first_call_resolution_rate: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'FCR rate as decimal (0.85 = 85%)',
    },
    customer_satisfaction_score: {
      type: DataTypes.DECIMAL(3, 2),
      comment: 'CSAT score out of 5.00',
    },
    // Availability preferences
    preferred_start_time: {
      type: DataTypes.TIME,
      comment: 'Preferred shift start time',
    },
    preferred_end_time: {
      type: DataTypes.TIME,
      comment: 'Preferred shift end time',
    },
    max_hours_per_day: {
      type: DataTypes.INTEGER,
      defaultValue: 8,
    },
    max_hours_per_week: {
      type: DataTypes.INTEGER,
      defaultValue: 40,
    },
    // Flexibility settings
    can_work_weekends: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    can_work_holidays: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    overtime_eligible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Training and certification
    training_completion_date: {
      type: DataTypes.DATE,
    },
    certification_level: {
      type: DataTypes.ENUM('trainee', 'junior', 'senior', 'expert', 'supervisor'),
      defaultValue: 'junior',
    },
    // Notes
    notes: {
      type: DataTypes.TEXT,
    },
  }, {
    indexes: [
      {
        fields: ['employee_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['employment_type'],
      },
    ],
    hooks: {
      beforeValidate: (agent) => {
        // Ensure proper email format
        if (agent.email) {
          agent.email = agent.email.toLowerCase().trim();
        }
        
        // Generate employee ID if not provided
        if (!agent.employee_id) {
          const timestamp = Date.now().toString().slice(-6);
          const initials = (agent.first_name.charAt(0) + agent.last_name.charAt(0)).toUpperCase();
          agent.employee_id = `EMP${initials}${timestamp}`;
        }
      },
    },
  });

  // Instance methods
  Agent.prototype.getFullName = function() {
    return `${this.first_name} ${this.last_name}`;
  };

  Agent.prototype.isAvailable = function(startTime, endTime) {
    // Basic availability check logic
    if (this.status !== 'active') return false;
    
    // Add more complex availability logic here
    return true;
  };

  Agent.prototype.getSkillLevel = function(skillName) {
    // This would be implemented with skill associations
    // Placeholder for now
    return 'intermediate';
  };

  return Agent;
}; 