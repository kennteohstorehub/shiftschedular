const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Channel = sequelize.define('Channel', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('voice_inbound', 'voice_outbound', 'email', 'chat', 'social_media', 'sms'),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: '1 = highest priority, 5 = lowest priority',
    },
    // Service level settings
    service_level_threshold: {
      type: DataTypes.INTEGER,
      comment: 'Target response time in seconds',
      defaultValue: 20,
    },
    service_level_target: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Target service level as decimal (0.80 = 80%)',
      defaultValue: 0.80,
    },
    // Channel-specific settings
    average_handle_time: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Average handle time in minutes for this channel',
    },
    wrap_up_time: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Average wrap-up time in minutes',
      defaultValue: 2.0,
    },
    // Capacity settings
    max_concurrent_interactions: {
      type: DataTypes.INTEGER,
      comment: 'Maximum concurrent interactions per agent',
      defaultValue: 1,
    },
    shrinkage_factor: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Shrinkage factor as decimal (0.25 = 25%)',
      defaultValue: 0.25,
    },
    // Operating hours
    operating_hours_start: {
      type: DataTypes.TIME,
      defaultValue: '08:00:00',
    },
    operating_hours_end: {
      type: DataTypes.TIME,
      defaultValue: '18:00:00',
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'America/New_York',
    },
    // Scheduling preferences
    min_staffing_level: {
      type: DataTypes.INTEGER,
      comment: 'Minimum number of agents required',
      defaultValue: 1,
    },
    preferred_staffing_buffer: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Preferred staffing buffer as decimal (0.10 = 10%)',
      defaultValue: 0.10,
    },
    // Channel-specific configuration
    configuration: {
      type: DataTypes.JSON,
      comment: 'Channel-specific configuration options',
      defaultValue: {},
    },
  }, {
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['priority'],
      },
    ],
    hooks: {
      beforeValidate: (channel) => {
        // Set default configuration based on channel type
        if (!channel.configuration || Object.keys(channel.configuration).length === 0) {
          switch (channel.type) {
            case 'voice_inbound':
              channel.configuration = {
                queue_timeout: 300,
                overflow_action: 'voicemail',
                call_recording: true,
              };
              break;
            case 'voice_outbound':
              channel.configuration = {
                dialer_mode: 'preview',
                call_recording: true,
                compliance_pause: 1,
              };
              break;
            case 'email':
              channel.configuration = {
                auto_response: true,
                priority_keywords: ['urgent', 'escalate'],
                max_response_time: 4, // hours
              };
              channel.max_concurrent_interactions = 5;
              break;
            case 'chat':
              channel.configuration = {
                proactive_chat: false,
                chat_timeout: 600,
                auto_translation: false,
              };
              channel.max_concurrent_interactions = 3;
              break;
            default:
              channel.configuration = {};
          }
        }
      },
    },
  });

  // Instance methods
  Channel.prototype.getServiceLevelPercentage = function() {
    return Math.round(this.service_level_target * 100);
  };

  Channel.prototype.isOperatingHour = function(time) {
    // Simple time check - could be enhanced with timezone support
    const currentTime = new Date(time).toTimeString().slice(0, 8);
    return currentTime >= this.operating_hours_start && currentTime <= this.operating_hours_end;
  };

  Channel.prototype.calculateRequiredStaff = function(forecastVolume) {
    // Basic Erlang C calculation simplified
    const workload = (forecastVolume * this.average_handle_time) / 60; // Convert to hours
    const shrinkageAdjusted = workload / (1 - this.shrinkage_factor);
    const buffered = shrinkageAdjusted * (1 + this.preferred_staffing_buffer);
    
    return Math.max(Math.ceil(buffered), this.min_staffing_level);
  };

  return Channel;
}; 