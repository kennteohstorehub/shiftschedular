const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Adherence = sequelize.define('Adherence', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Time period
    adherence_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    period_start: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    period_end: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    // Schedule vs actual
    scheduled_start: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    scheduled_end: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    actual_start: {
      type: DataTypes.TIME,
    },
    actual_end: {
      type: DataTypes.TIME,
    },
    // Adherence metrics
    adherence_percentage: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Overall adherence percentage for the period',
    },
    occupancy_percentage: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Occupancy percentage (productive time / available time)',
    },
    utilization_percentage: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Utilization percentage (total work time / scheduled time)',
    },
    // Time tracking
    scheduled_minutes: {
      type: DataTypes.INTEGER,
      comment: 'Total scheduled minutes',
    },
    worked_minutes: {
      type: DataTypes.INTEGER,
      comment: 'Total minutes actually worked',
    },
    productive_minutes: {
      type: DataTypes.INTEGER,
      comment: 'Minutes spent on productive activities',
    },
    break_minutes: {
      type: DataTypes.INTEGER,
      comment: 'Minutes spent on breaks',
    },
    unavailable_minutes: {
      type: DataTypes.INTEGER,
      comment: 'Minutes unavailable for work',
    },
    // Activity breakdown
    activity_log: {
      type: DataTypes.JSON,
      comment: 'Detailed log of activities during the period',
      defaultValue: [],
    },
    // Interactions and performance
    interactions_handled: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    average_handle_time: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Average handle time in minutes',
    },
    quality_score: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Quality score for the period',
    },
    customer_satisfaction: {
      type: DataTypes.DECIMAL(3, 2),
      comment: 'Customer satisfaction score',
    },
    // Exceptions and variances
    exceptions: {
      type: DataTypes.JSON,
      comment: 'List of adherence exceptions',
      defaultValue: [],
    },
    variance_reasons: {
      type: DataTypes.JSON,
      comment: 'Reasons for schedule variances',
      defaultValue: [],
    },
    // Status and approvals
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'disputed', 'corrected'),
      defaultValue: 'pending',
    },
    reviewed_by: {
      type: DataTypes.UUID,
      comment: 'User ID who reviewed this adherence record',
    },
    reviewed_at: {
      type: DataTypes.DATE,
    },
    // Compliance
    compliance_score: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Compliance score for regulatory requirements',
    },
    compliance_notes: {
      type: DataTypes.TEXT,
    },
    // Real-time updates
    is_real_time: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is a real-time adherence record',
    },
    last_activity_time: {
      type: DataTypes.DATE,
      comment: 'Last recorded activity time',
    },
    current_state: {
      type: DataTypes.ENUM('available', 'busy', 'unavailable', 'break', 'offline'),
      comment: 'Current agent state',
    },
    // Notes
    notes: {
      type: DataTypes.TEXT,
    },
    agent_notes: {
      type: DataTypes.TEXT,
      comment: 'Notes from the agent',
    },
  }, {
    indexes: [
      {
        fields: ['agent_id', 'adherence_date'],
      },
      {
        fields: ['adherence_date'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['is_real_time'],
      },
      {
        unique: true,
        fields: ['agent_id', 'adherence_date', 'period_start'],
        name: 'unique_adherence_period',
      },
    ],
    hooks: {
      beforeValidate: (adherence) => {
        // Calculate minutes
        if (adherence.scheduled_start && adherence.scheduled_end) {
          const start = new Date(`2000-01-01T${adherence.scheduled_start}`);
          const end = new Date(`2000-01-01T${adherence.scheduled_end}`);
          adherence.scheduled_minutes = (end - start) / (1000 * 60);
        }
        
        if (adherence.actual_start && adherence.actual_end) {
          const start = new Date(`2000-01-01T${adherence.actual_start}`);
          const end = new Date(`2000-01-01T${adherence.actual_end}`);
          adherence.worked_minutes = (end - start) / (1000 * 60);
        }
        
        // Calculate adherence percentage
        if (adherence.scheduled_minutes && adherence.worked_minutes) {
          adherence.adherence_percentage = Math.min(
            adherence.worked_minutes / adherence.scheduled_minutes,
            1.0
          );
        }
        
        // Calculate utilization
        if (adherence.scheduled_minutes && adherence.worked_minutes) {
          adherence.utilization_percentage = adherence.worked_minutes / adherence.scheduled_minutes;
        }
        
        // Calculate occupancy
        if (adherence.worked_minutes && adherence.productive_minutes) {
          adherence.occupancy_percentage = adherence.productive_minutes / adherence.worked_minutes;
        }
      },
    },
  });

  // Class methods
  Adherence.getDailyAdherence = function(agentId, date) {
    return this.findAll({
      where: {
        agent_id: agentId,
        adherence_date: date,
      },
      order: [['period_start', 'ASC']],
    });
  };

  Adherence.getTeamAdherence = function(date) {
    return this.findAll({
      where: {
        adherence_date: date,
      },
      include: [
        {
          model: sequelize.models.Agent,
          attributes: ['id', 'first_name', 'last_name', 'employee_id'],
        },
      ],
    });
  };

  Adherence.getAdherenceMetrics = function(agentId, startDate, endDate) {
    return this.findAll({
      where: {
        agent_id: agentId,
        adherence_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
      },
      attributes: [
        'adherence_date',
        'adherence_percentage',
        'occupancy_percentage',
        'utilization_percentage',
        'interactions_handled',
        'quality_score',
      ],
    });
  };

  // Instance methods
  Adherence.prototype.isOnTime = function() {
    if (!this.actual_start || !this.scheduled_start) return null;
    
    const actualStart = new Date(`2000-01-01T${this.actual_start}`);
    const scheduledStart = new Date(`2000-01-01T${this.scheduled_start}`);
    
    // Allow 5 minutes grace period
    return actualStart <= new Date(scheduledStart.getTime() + 5 * 60 * 1000);
  };

  Adherence.prototype.hasExceptions = function() {
    return this.exceptions && this.exceptions.length > 0;
  };

  Adherence.prototype.isCompliant = function(threshold = 0.85) {
    return this.adherence_percentage >= threshold;
  };

  Adherence.prototype.addException = function(type, reason, startTime, endTime) {
    if (!this.exceptions) this.exceptions = [];
    
    this.exceptions.push({
      type,
      reason,
      start_time: startTime,
      end_time: endTime,
      timestamp: new Date(),
    });
    
    return this.save();
  };

  Adherence.prototype.addActivity = function(activity, startTime, endTime, details = {}) {
    if (!this.activity_log) this.activity_log = [];
    
    this.activity_log.push({
      activity,
      start_time: startTime,
      end_time: endTime,
      details,
      timestamp: new Date(),
    });
    
    return this.save();
  };

  Adherence.prototype.calculateProductiveTime = function() {
    if (!this.activity_log) return 0;
    
    const productiveActivities = ['customer_interaction', 'work_preparation', 'training'];
    
    return this.activity_log
      .filter(log => productiveActivities.includes(log.activity))
      .reduce((total, log) => {
        const start = new Date(`2000-01-01T${log.start_time}`);
        const end = new Date(`2000-01-01T${log.end_time}`);
        return total + (end - start) / (1000 * 60);
      }, 0);
  };

  return Adherence;
}; 