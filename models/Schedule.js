const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Schedule = sequelize.define('Schedule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('monthly', 'weekly', 'daily', 'adhoc'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'active', 'completed', 'cancelled'),
      defaultValue: 'draft',
    },
    // Time period
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'America/New_York',
    },
    // Scheduling metadata
    created_by: {
      type: DataTypes.UUID,
      comment: 'User ID who created this schedule',
    },
    published_at: {
      type: DataTypes.DATE,
    },
    published_by: {
      type: DataTypes.UUID,
      comment: 'User ID who published this schedule',
    },
    // Schedule constraints
    constraints: {
      type: DataTypes.JSON,
      comment: 'Scheduling constraints and rules',
      defaultValue: {
        max_consecutive_days: 5,
        min_days_off_per_week: 2,
        max_hours_per_day: 8,
        max_hours_per_week: 40,
        min_break_duration: 30, // minutes
        lunch_break_duration: 60, // minutes
        min_time_between_shifts: 8, // hours
      },
    },
    // Optimization settings
    optimization_preferences: {
      type: DataTypes.JSON,
      comment: 'Preferences for schedule optimization',
      defaultValue: {
        prioritize_agent_preferences: true,
        minimize_overtime: true,
        balance_workload: true,
        optimize_for_service_level: true,
        allow_split_shifts: false,
      },
    },
    // Performance metrics
    service_level_achieved: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Actual service level achieved with this schedule',
    },
    coverage_percentage: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Percentage of required coverage achieved',
    },
    agent_satisfaction_score: {
      type: DataTypes.DECIMAL(3, 2),
      comment: 'Agent satisfaction score for this schedule (1-5)',
    },
    total_labor_cost: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Total estimated labor cost for this schedule',
    },
    // Approval workflow
    approval_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'changes_requested'),
      defaultValue: 'pending',
    },
    approved_by: {
      type: DataTypes.UUID,
      comment: 'User ID who approved this schedule',
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },
    // Version control
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    parent_schedule_id: {
      type: DataTypes.UUID,
      comment: 'Reference to parent schedule if this is a revision',
    },
    // Notes and comments
    notes: {
      type: DataTypes.TEXT,
    },
    change_log: {
      type: DataTypes.JSON,
      comment: 'Log of changes made to this schedule',
      defaultValue: [],
    },
  }, {
    indexes: [
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['start_date', 'end_date'],
      },
      {
        fields: ['created_by'],
      },
      {
        fields: ['approval_status'],
      },
    ],
    hooks: {
      beforeValidate: (schedule) => {
        // Ensure end date is after start date
        if (schedule.start_date && schedule.end_date) {
          if (new Date(schedule.end_date) <= new Date(schedule.start_date)) {
            throw new Error('End date must be after start date');
          }
        }
        
        // Set name based on type and dates if not provided
        if (!schedule.name && schedule.type && schedule.start_date) {
          const startDate = new Date(schedule.start_date);
          const month = startDate.toLocaleString('default', { month: 'long' });
          const year = startDate.getFullYear();
          
          switch (schedule.type) {
            case 'monthly':
              schedule.name = `${month} ${year} Schedule`;
              break;
            case 'weekly':
              schedule.name = `Week of ${startDate.toISOString().split('T')[0]}`;
              break;
            case 'daily':
              schedule.name = `Daily Schedule ${startDate.toISOString().split('T')[0]}`;
              break;
            default:
              schedule.name = `Schedule ${startDate.toISOString().split('T')[0]}`;
          }
        }
      },
      beforeUpdate: (schedule) => {
        // Add to change log
        if (schedule.changed()) {
          const changes = {
            timestamp: new Date(),
            changes: schedule.changed(),
            changed_by: schedule.dataValues.updated_by || 'system',
          };
          
          if (!schedule.change_log) {
            schedule.change_log = [];
          }
          schedule.change_log.push(changes);
        }
      },
    },
  });

  // Class methods
  Schedule.getActiveSchedule = function(date = new Date()) {
    const dateOnly = date.toISOString().split('T')[0];
    return this.findOne({
      where: {
        status: 'active',
        start_date: { [sequelize.Sequelize.Op.lte]: dateOnly },
        end_date: { [sequelize.Sequelize.Op.gte]: dateOnly },
      },
    });
  };

  Schedule.getCurrentSchedules = function(type = null) {
    const today = new Date().toISOString().split('T')[0];
    const where = {
      status: ['active', 'published'],
      start_date: { [sequelize.Sequelize.Op.lte]: today },
      end_date: { [sequelize.Sequelize.Op.gte]: today },
    };
    
    if (type) {
      where.type = type;
    }
    
    return this.findAll({ where, order: [['start_date', 'ASC']] });
  };

  // Instance methods
  Schedule.prototype.getDurationInDays = function() {
    const start = new Date(this.start_date);
    const end = new Date(this.end_date);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  Schedule.prototype.isActive = function() {
    const today = new Date().toISOString().split('T')[0];
    return this.status === 'active' && 
           this.start_date <= today && 
           this.end_date >= today;
  };

  Schedule.prototype.canBeModified = function() {
    return ['draft', 'changes_requested'].includes(this.status);
  };

  Schedule.prototype.publish = function(publisherId) {
    this.status = 'published';
    this.published_at = new Date();
    this.published_by = publisherId;
    return this.save();
  };

  return Schedule;
}; 