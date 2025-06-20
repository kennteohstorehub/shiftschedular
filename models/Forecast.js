const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Forecast = sequelize.define('Forecast', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Time period
    forecast_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    forecast_hour: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Hour of the day (0-23)',
      validate: {
        min: 0,
        max: 23,
      },
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'America/New_York',
    },
    // Forecast type and methodology
    forecast_type: {
      type: DataTypes.ENUM('hourly', 'daily', 'weekly', 'monthly'),
      defaultValue: 'hourly',
    },
    forecast_method: {
      type: DataTypes.ENUM('historical_average', 'trend_analysis', 'seasonal_decomposition', 'machine_learning', 'manual'),
      defaultValue: 'historical_average',
    },
    // Volume predictions
    predicted_volume: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Predicted number of interactions',
    },
    confidence_level: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Confidence level of the forecast (0.0 to 1.0)',
      defaultValue: 0.80,
    },
    prediction_variance: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Statistical variance of the prediction',
    },
    // Range predictions
    min_volume: {
      type: DataTypes.INTEGER,
      comment: 'Minimum expected volume (lower bound)',
    },
    max_volume: {
      type: DataTypes.INTEGER,
      comment: 'Maximum expected volume (upper bound)',
    },
    // Staffing requirements
    required_agents: {
      type: DataTypes.INTEGER,
      comment: 'Number of agents required to meet service level',
    },
    optimal_agents: {
      type: DataTypes.INTEGER,
      comment: 'Optimal number of agents considering cost and service level',
    },
    minimum_agents: {
      type: DataTypes.INTEGER,
      comment: 'Minimum number of agents required',
    },
    // Service level predictions
    predicted_service_level: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Predicted service level achievement',
    },
    predicted_average_wait_time: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Predicted average wait time in seconds',
    },
    predicted_abandonment_rate: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Predicted abandonment rate',
    },
    // Factors and adjustments
    seasonal_factor: {
      type: DataTypes.DECIMAL(8, 4),
      comment: 'Seasonal adjustment factor',
      defaultValue: 1.0,
    },
    trend_factor: {
      type: DataTypes.DECIMAL(8, 4),
      comment: 'Trend adjustment factor',
      defaultValue: 1.0,
    },
    special_event_factor: {
      type: DataTypes.DECIMAL(8, 4),
      comment: 'Special event adjustment factor',
      defaultValue: 1.0,
    },
    weather_factor: {
      type: DataTypes.DECIMAL(8, 4),
      comment: 'Weather impact factor',
      defaultValue: 1.0,
    },
    // External factors
    external_factors: {
      type: DataTypes.JSON,
      comment: 'External factors affecting the forecast',
      defaultValue: {},
    },
    // Actual vs predicted (filled after the fact)
    actual_volume: {
      type: DataTypes.INTEGER,
      comment: 'Actual volume observed',
    },
    actual_service_level: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Actual service level achieved',
    },
    actual_agents_scheduled: {
      type: DataTypes.INTEGER,
      comment: 'Actual number of agents scheduled',
    },
    actual_agents_available: {
      type: DataTypes.INTEGER,
      comment: 'Actual number of agents available',
    },
    // Accuracy metrics
    forecast_accuracy: {
      type: DataTypes.DECIMAL(5, 4),
      comment: 'Forecast accuracy percentage',
    },
    mean_absolute_error: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Mean absolute error',
    },
    mean_squared_error: {
      type: DataTypes.DECIMAL(10, 2),
      comment: 'Mean squared error',
    },
    // Status and validation
    status: {
      type: DataTypes.ENUM('draft', 'generated', 'reviewed', 'approved', 'published', 'archived'),
      defaultValue: 'generated',
    },
    is_manual_override: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    override_reason: {
      type: DataTypes.TEXT,
    },
    // Metadata
    model_version: {
      type: DataTypes.STRING,
      comment: 'Version of the forecasting model used',
    },
    generation_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    created_by: {
      type: DataTypes.UUID,
      comment: 'User ID who created/generated this forecast',
    },
    // Notes
    notes: {
      type: DataTypes.TEXT,
    },
  }, {
    indexes: [
      {
        fields: ['forecast_date', 'forecast_hour'],
      },
      {
        fields: ['channel_id', 'forecast_date'],
      },
      {
        fields: ['skill_id', 'forecast_date'],
      },
      {
        fields: ['forecast_type'],
      },
      {
        fields: ['status'],
      },
      {
        unique: true,
        fields: ['channel_id', 'skill_id', 'forecast_date', 'forecast_hour'],
        name: 'unique_forecast_period',
      },
    ],
    hooks: {
      beforeValidate: (forecast) => {
        // Calculate bounds if not provided
        if (forecast.predicted_volume && !forecast.min_volume) {
          forecast.min_volume = Math.max(0, Math.floor(forecast.predicted_volume * 0.7));
        }
        if (forecast.predicted_volume && !forecast.max_volume) {
          forecast.max_volume = Math.ceil(forecast.predicted_volume * 1.3);
        }
        
        // Set default confidence level based on method
        if (!forecast.confidence_level) {
          switch (forecast.forecast_method) {
            case 'machine_learning':
              forecast.confidence_level = 0.85;
              break;
            case 'seasonal_decomposition':
              forecast.confidence_level = 0.80;
              break;
            case 'trend_analysis':
              forecast.confidence_level = 0.75;
              break;
            case 'historical_average':
              forecast.confidence_level = 0.70;
              break;
            case 'manual':
              forecast.confidence_level = 0.60;
              break;
            default:
              forecast.confidence_level = 0.70;
          }
        }
      },
      beforeUpdate: (forecast) => {
        forecast.last_updated = new Date();
        
        // Calculate accuracy if actual data is available
        if (forecast.actual_volume && forecast.predicted_volume) {
          const error = Math.abs(forecast.actual_volume - forecast.predicted_volume);
          forecast.forecast_accuracy = 1 - (error / Math.max(forecast.actual_volume, forecast.predicted_volume));
          forecast.mean_absolute_error = error;
          forecast.mean_squared_error = error * error;
        }
      },
    },
  });

  // Class methods
  Forecast.getLatestForecast = function(channelId, skillId = null, date = null) {
    const where = {
      channel_id: channelId,
      status: ['published', 'approved'],
    };
    
    if (skillId) where.skill_id = skillId;
    if (date) where.forecast_date = date;
    
    return this.findOne({
      where,
      order: [['generation_time', 'DESC']],
    });
  };

  Forecast.getDailyForecast = function(channelId, date) {
    return this.findAll({
      where: {
        channel_id: channelId,
        forecast_date: date,
        status: ['published', 'approved'],
      },
      order: [['forecast_hour', 'ASC']],
    });
  };

  Forecast.getAccuracyMetrics = function(channelId, startDate, endDate) {
    return this.findAll({
      where: {
        channel_id: channelId,
        forecast_date: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate],
        },
        actual_volume: {
          [sequelize.Sequelize.Op.not]: null,
        },
      },
      attributes: [
        'forecast_date',
        'predicted_volume',
        'actual_volume',
        'forecast_accuracy',
        'mean_absolute_error',
      ],
    });
  };

  // Instance methods
  Forecast.prototype.isAccurate = function(threshold = 0.80) {
    return this.forecast_accuracy >= threshold;
  };

  Forecast.prototype.getErrorPercentage = function() {
    if (!this.actual_volume || !this.predicted_volume) return null;
    
    const error = Math.abs(this.actual_volume - this.predicted_volume);
    return (error / this.actual_volume) * 100;
  };

  Forecast.prototype.isWithinRange = function() {
    if (!this.actual_volume) return null;
    
    return this.actual_volume >= this.min_volume && this.actual_volume <= this.max_volume;
  };

  Forecast.prototype.adjustForSpecialEvent = function(factor, reason) {
    this.special_event_factor = factor;
    this.predicted_volume = Math.round(this.predicted_volume * factor);
    this.min_volume = Math.round(this.min_volume * factor);
    this.max_volume = Math.round(this.max_volume * factor);
    this.is_manual_override = true;
    this.override_reason = reason;
    
    return this.save();
  };

  Forecast.prototype.getAdjustedVolume = function() {
    return Math.round(
      this.predicted_volume * 
      this.seasonal_factor * 
      this.trend_factor * 
      this.special_event_factor * 
      this.weather_factor
    );
  };

  return Forecast;
}; 