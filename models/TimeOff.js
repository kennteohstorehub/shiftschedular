const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TimeOff = sequelize.define('TimeOff', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Time off period
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    // Type and classification
    type: {
      type: DataTypes.ENUM(
        'vacation', 'sick_leave', 'personal_leave', 'medical_leave', 
        'emergency_leave', 'bereavement', 'jury_duty', 'military_leave',
        'unpaid_leave', 'comp_time', 'holiday'
      ),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('paid', 'unpaid', 'partial_pay'),
      defaultValue: 'paid',
    },
    // Request details
    reason: {
      type: DataTypes.TEXT,
      comment: 'Reason for time off request',
    },
    is_partial_day: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    partial_day_details: {
      type: DataTypes.JSON,
      comment: 'Details for partial day requests (start_time, end_time, hours)',
      defaultValue: null,
    },
    // Status and approval
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'cancelled', 'completed'),
      defaultValue: 'draft',
    },
    approval_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    approved_by: {
      type: DataTypes.UUID,
      comment: 'User ID who approved/rejected this request',
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },
    // Timing and priority
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'emergency'),
      defaultValue: 'normal',
    },
    request_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    advance_notice_days: {
      type: DataTypes.INTEGER,
      comment: 'Number of days advance notice given',
    },
    // Coverage and impact
    coverage_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    coverage_arranged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    coverage_agent_id: {
      type: DataTypes.UUID,
      comment: 'Agent ID who will provide coverage',
    },
    business_impact: {
      type: DataTypes.ENUM('none', 'low', 'medium', 'high', 'critical'),
      defaultValue: 'low',
    },
    // Accrual and balance
    hours_requested: {
      type: DataTypes.DECIMAL(5, 2),
      comment: 'Total hours requested',
    },
    hours_approved: {
      type: DataTypes.DECIMAL(5, 2),
      comment: 'Total hours approved (may differ from requested)',
    },
    accrual_balance_before: {
      type: DataTypes.DECIMAL(8, 2),
      comment: 'Accrual balance before this request',
    },
    accrual_balance_after: {
      type: DataTypes.DECIMAL(8, 2),
      comment: 'Accrual balance after this request',
    },
    // Documentation
    documentation_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    documentation_provided: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    documentation_notes: {
      type: DataTypes.TEXT,
    },
    // Recurring requests
    is_recurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    recurring_pattern: {
      type: DataTypes.JSON,
      comment: 'Pattern for recurring time off (frequency, end_date, etc.)',
      defaultValue: null,
    },
    parent_request_id: {
      type: DataTypes.UUID,
      comment: 'Parent request ID for recurring requests',
    },
    // Workflow and notifications
    workflow_stage: {
      type: DataTypes.STRING,
      comment: 'Current workflow stage',
      defaultValue: 'submitted',
    },
    notifications_sent: {
      type: DataTypes.JSON,
      comment: 'Log of notifications sent',
      defaultValue: [],
    },
    // Notes and comments
    notes: {
      type: DataTypes.TEXT,
      comment: 'Additional notes or comments',
    },
    manager_notes: {
      type: DataTypes.TEXT,
      comment: 'Notes from manager/approver',
    },
    // Audit trail
    created_by: {
      type: DataTypes.UUID,
      comment: 'User ID who created this request',
    },
    last_modified_by: {
      type: DataTypes.UUID,
      comment: 'User ID who last modified this request',
    },
  }, {
    indexes: [
      {
        fields: ['agent_id'],
      },
      {
        fields: ['start_date', 'end_date'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['approval_status'],
      },
      {
        fields: ['priority'],
      },
      {
        fields: ['coverage_required'],
      },
    ],
    hooks: {
      beforeValidate: (timeOff) => {
        // Ensure end date is not before start date
        if (timeOff.start_date && timeOff.end_date) {
          if (new Date(timeOff.end_date) < new Date(timeOff.start_date)) {
            throw new Error('End date cannot be before start date');
          }
        }
        
        // Calculate advance notice days
        if (timeOff.start_date && timeOff.request_date) {
          const startDate = new Date(timeOff.start_date);
          const requestDate = new Date(timeOff.request_date);
          timeOff.advance_notice_days = Math.ceil((startDate - requestDate) / (1000 * 60 * 60 * 24));
        }
        
        // Calculate hours requested for full days
        if (!timeOff.is_partial_day && timeOff.start_date && timeOff.end_date) {
          const startDate = new Date(timeOff.start_date);
          const endDate = new Date(timeOff.end_date);
          const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
          timeOff.hours_requested = days * 8; // Assuming 8-hour work days
        }
        
        // Set documentation requirements based on type
        if (['medical_leave', 'bereavement', 'jury_duty', 'military_leave'].includes(timeOff.type)) {
          timeOff.documentation_required = true;
        }
      },
      beforeUpdate: (timeOff) => {
        // Update balance after approval
        if (timeOff.changed('approval_status') && timeOff.approval_status === 'approved') {
          timeOff.hours_approved = timeOff.hours_approved || timeOff.hours_requested;
          
          if (timeOff.accrual_balance_before !== null) {
            timeOff.accrual_balance_after = timeOff.accrual_balance_before - timeOff.hours_approved;
          }
        }
      },
    },
  });

  // Class methods
  TimeOff.getConflictingRequests = function(agentId, startDate, endDate) {
    return this.findAll({
      where: {
        agent_id: agentId,
        status: ['approved', 'pending_approval'],
        [sequelize.Sequelize.Op.or]: [
          {
            start_date: {
              [sequelize.Sequelize.Op.between]: [startDate, endDate],
            },
          },
          {
            end_date: {
              [sequelize.Sequelize.Op.between]: [startDate, endDate],
            },
          },
          {
            [sequelize.Sequelize.Op.and]: [
              { start_date: { [sequelize.Sequelize.Op.lte]: startDate } },
              { end_date: { [sequelize.Sequelize.Op.gte]: endDate } },
            ],
          },
        ],
      },
    });
  };

  TimeOff.getPendingApprovals = function() {
    return this.findAll({
      where: {
        approval_status: 'pending',
        status: 'pending_approval',
      },
      order: [['priority', 'DESC'], ['request_date', 'ASC']],
    });
  };

  // Instance methods
  TimeOff.prototype.getDurationInDays = function() {
    if (!this.start_date || !this.end_date) return 0;
    
    const startDate = new Date(this.start_date);
    const endDate = new Date(this.end_date);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  TimeOff.prototype.getDurationInHours = function() {
    if (this.is_partial_day && this.partial_day_details) {
      return this.partial_day_details.hours || 0;
    }
    return this.getDurationInDays() * 8; // Assuming 8-hour work days
  };

  TimeOff.prototype.isApproved = function() {
    return this.approval_status === 'approved';
  };

  TimeOff.prototype.isPending = function() {
    return this.approval_status === 'pending';
  };

  TimeOff.prototype.isEmergency = function() {
    return this.priority === 'emergency' || this.advance_notice_days < 1;
  };

  TimeOff.prototype.requiresCoverage = function() {
    return this.coverage_required && !this.coverage_arranged;
  };

  TimeOff.prototype.overlaps = function(otherTimeOff) {
    const thisStart = new Date(this.start_date);
    const thisEnd = new Date(this.end_date);
    const otherStart = new Date(otherTimeOff.start_date);
    const otherEnd = new Date(otherTimeOff.end_date);
    
    return thisStart <= otherEnd && thisEnd >= otherStart;
  };

  TimeOff.prototype.approve = function(approverId, notes = null) {
    this.approval_status = 'approved';
    this.status = 'approved';
    this.approved_by = approverId;
    this.approved_at = new Date();
    if (notes) this.manager_notes = notes;
    
    return this.save();
  };

  TimeOff.prototype.reject = function(approverId, reason) {
    this.approval_status = 'rejected';
    this.status = 'rejected';
    this.approved_by = approverId;
    this.approved_at = new Date();
    this.rejection_reason = reason;
    
    return this.save();
  };

  return TimeOff;
}; 