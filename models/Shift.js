const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Shift = sequelize.define('Shift', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Basic shift information
    shift_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'America/New_York',
    },
    // Shift type and status
    shift_type: {
      type: DataTypes.ENUM('regular', 'overtime', 'break_coverage', 'emergency', 'training'),
      defaultValue: 'regular',
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
      defaultValue: 'scheduled',
    },
    // Break scheduling
    breaks: {
      type: DataTypes.JSON,
      comment: 'Array of break periods with start and end times',
      defaultValue: [],
    },
    lunch_break: {
      type: DataTypes.JSON,
      comment: 'Lunch break period with start and end times',
      defaultValue: null,
    },
    // Channel assignments
    primary_channel_id: {
      type: DataTypes.UUID,
      comment: 'Primary channel assignment for this shift',
    },
    secondary_channels: {
      type: DataTypes.JSON,
      comment: 'Array of secondary channel IDs',
      defaultValue: [],
    },
    // Skill requirements
    required_skills: {
      type: DataTypes.JSON,
      comment: 'Array of skill IDs required for this shift',
      defaultValue: [],
    },
    // Workload and capacity
    expected_volume: {
      type: DataTypes.INTEGER,
      comment: 'Expected interaction volume for this shift',
    },
    capacity_percentage: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Agent capacity utilization (0.80 = 80%)',
      defaultValue: 0.85,
    },
    // Cost information
    hourly_rate: {
      type: DataTypes.DECIMAL(8, 2),
      comment: 'Hourly rate for this shift',
    },
    overtime_rate: {
      type: DataTypes.DECIMAL(8, 2),
      comment: 'Overtime hourly rate if applicable',
    },
    total_cost: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Total cost for this shift',
    },
    // Actual performance data
    actual_start_time: {
      type: DataTypes.TIME,
      comment: 'Actual time agent started work',
    },
    actual_end_time: {
      type: DataTypes.TIME,
      comment: 'Actual time agent ended work',
    },
    actual_breaks: {
      type: DataTypes.JSON,
      comment: 'Actual break times taken',
      defaultValue: [],
    },
    interactions_handled: {
      type: DataTypes.INTEGER,
      comment: 'Number of interactions handled during shift',
      defaultValue: 0,
    },
    average_handle_time: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Average handle time for this shift in minutes',
    },
    adherence_percentage: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Schedule adherence percentage',
    },
    // Approval and modifications
    approval_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'auto_approved'),
      defaultValue: 'pending',
    },
    approved_by: {
      type: DataTypes.UUID,
      comment: 'User ID who approved this shift',
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    // Swap and coverage
    is_swap_request: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    swap_with_agent_id: {
      type: DataTypes.UUID,
      comment: 'Agent ID for shift swap',
    },
    swap_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
      comment: 'Status of shift swap request',
    },
    coverage_request: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    coverage_reason: {
      type: DataTypes.ENUM('sick_leave', 'personal_leave', 'emergency', 'vacation', 'other'),
      comment: 'Reason for coverage request',
    },
    // Notes
    notes: {
      type: DataTypes.TEXT,
    },
    agent_notes: {
      type: DataTypes.TEXT,
      comment: 'Notes added by the agent',
    },
  }, {
    indexes: [
      {
        fields: ['shift_date'],
      },
      {
        fields: ['agent_id', 'shift_date'],
      },
      {
        fields: ['schedule_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['shift_type'],
      },
      {
        fields: ['primary_channel_id'],
      },
    ],
    hooks: {
      beforeValidate: (shift) => {
        // Ensure end time is after start time
        if (shift.start_time && shift.end_time) {
          if (shift.end_time <= shift.start_time) {
            throw new Error('End time must be after start time');
          }
        }
        
        // Calculate total cost if hourly rate is provided
        if (shift.hourly_rate && shift.start_time && shift.end_time) {
          const duration = shift.getDurationInHours();
          shift.total_cost = duration * shift.hourly_rate;
        }
      },
    },
  });

  // Instance methods
  Shift.prototype.getDurationInHours = function() {
    if (!this.start_time || !this.end_time) return 0;
    
    const start = new Date(`2000-01-01T${this.start_time}`);
    const end = new Date(`2000-01-01T${this.end_time}`);
    
    // Handle shifts that cross midnight
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    return (end - start) / (1000 * 60 * 60);
  };

  Shift.prototype.getDurationInMinutes = function() {
    return this.getDurationInHours() * 60;
  };

  Shift.prototype.isOvertime = function() {
    return this.shift_type === 'overtime' || this.getDurationInHours() > 8;
  };

  Shift.prototype.overlaps = function(otherShift) {
    if (this.shift_date !== otherShift.shift_date) return false;
    
    const thisStart = new Date(`2000-01-01T${this.start_time}`);
    const thisEnd = new Date(`2000-01-01T${this.end_time}`);
    const otherStart = new Date(`2000-01-01T${otherShift.start_time}`);
    const otherEnd = new Date(`2000-01-01T${otherShift.end_time}`);
    
    return thisStart < otherEnd && thisEnd > otherStart;
  };

  Shift.prototype.isToday = function() {
    const today = new Date().toISOString().split('T')[0];
    return this.shift_date === today;
  };

  Shift.prototype.canBeModified = function() {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() + 1); // 24 hours before
    
    const shiftDateTime = new Date(`${this.shift_date}T${this.start_time}`);
    
    return shiftDateTime > cutoffTime && 
           ['scheduled', 'confirmed'].includes(this.status);
  };

  Shift.prototype.calculateAdherence = function() {
    if (!this.actual_start_time || !this.actual_end_time) return null;
    
    const scheduledMinutes = this.getDurationInMinutes();
    const actualStart = new Date(`2000-01-01T${this.actual_start_time}`);
    const actualEnd = new Date(`2000-01-01T${this.actual_end_time}`);
    const actualMinutes = (actualEnd - actualStart) / (1000 * 60);
    
    const adherence = Math.min(actualMinutes / scheduledMinutes, 1.0);
    this.adherence_percentage = adherence;
    
    return adherence;
  };

  return Shift;
}; 