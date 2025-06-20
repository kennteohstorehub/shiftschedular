const moment = require('moment-timezone');
const { Forecast, Channel, Skill } = require('../models');
const logger = require('../utils/logger');

class ForecastService {
  constructor() {
    this.defaultTimezone = 'America/New_York';
  }

  /**
   * Generate hourly forecasts for a specific channel and date
   */
  async generateHourlyForecasts(channelId, date, skillId = null) {
    try {
      const channel = await Channel.findByPk(channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      const forecasts = [];
      const targetDate = moment(date).format('YYYY-MM-DD');

      // Generate forecasts for each hour of the day
      for (let hour = 0; hour < 24; hour++) {
        // Skip hours outside operating hours
        if (!this.isOperatingHour(hour, channel)) {
          continue;
        }

        const historicalData = await this.getHistoricalData(channelId, hour, skillId);
        const seasonalFactors = await this.getSeasonalFactors(date, hour);
        const externalFactors = await this.getExternalFactors(date, hour);

        const predictedVolume = this.calculatePredictedVolume(
          historicalData,
          seasonalFactors,
          externalFactors
        );

        const requiredAgents = this.calculateRequiredAgents(
          predictedVolume,
          channel,
          skillId
        );

        const forecast = await Forecast.create({
          channel_id: channelId,
          skill_id: skillId,
          forecast_date: targetDate,
          forecast_hour: hour,
          forecast_type: 'hourly',
          forecast_method: 'seasonal_decomposition',
          predicted_volume: predictedVolume.volume,
          confidence_level: predictedVolume.confidence,
          min_volume: predictedVolume.minVolume,
          max_volume: predictedVolume.maxVolume,
          required_agents: requiredAgents.required,
          optimal_agents: requiredAgents.optimal,
          minimum_agents: requiredAgents.minimum,
          predicted_service_level: requiredAgents.predictedServiceLevel,
          predicted_average_wait_time: requiredAgents.predictedWaitTime,
          seasonal_factor: seasonalFactors.seasonal,
          trend_factor: seasonalFactors.trend,
          special_event_factor: externalFactors.specialEvent,
          weather_factor: externalFactors.weather,
          external_factors: externalFactors,
          status: 'generated',
          model_version: '1.0.0',
          created_by: 'system',
        });

        forecasts.push(forecast);
      }

      logger.info(`Generated ${forecasts.length} hourly forecasts for channel ${channelId} on ${date}`);
      return forecasts;

    } catch (error) {
      logger.error('Error generating hourly forecasts:', error);
      throw error;
    }
  }

  /**
   * Calculate predicted volume using historical data and adjustment factors
   */
  calculatePredictedVolume(historicalData, seasonalFactors, externalFactors) {
    if (!historicalData.length) {
      return {
        volume: 10, // Default fallback
        confidence: 0.30,
        minVolume: 5,
        maxVolume: 20,
      };
    }

    // Calculate base volume from historical average
    const baseVolume = historicalData.reduce((sum, data) => sum + data.volume, 0) / historicalData.length;
    
    // Apply seasonal adjustments
    const seasonallyAdjusted = baseVolume * seasonalFactors.seasonal * seasonalFactors.trend;
    
    // Apply external factors
    const finalVolume = Math.round(
      seasonallyAdjusted * 
      externalFactors.specialEvent * 
      externalFactors.weather *
      externalFactors.holidayFactor
    );

    // Calculate confidence based on data quality and variance
    const variance = this.calculateVariance(historicalData.map(d => d.volume));
    const confidence = Math.max(0.40, Math.min(0.95, 1 - (variance / baseVolume)));

    // Calculate min/max bounds
    const variabilityFactor = 1 - confidence;
    const minVolume = Math.max(0, Math.floor(finalVolume * (1 - variabilityFactor)));
    const maxVolume = Math.ceil(finalVolume * (1 + variabilityFactor));

    return {
      volume: finalVolume,
      confidence,
      minVolume,
      maxVolume,
    };
  }

  /**
   * Calculate required agents using simplified Erlang C formula
   */
  calculateRequiredAgents(predictedVolume, channel, skillId = null) {
    const volume = predictedVolume.volume;
    const aht = channel.average_handle_time || 5; // minutes
    const wrapUpTime = channel.wrap_up_time || 2; // minutes
    const serviceLevel = channel.service_level_target || 0.80;
    const targetAnswerTime = channel.service_level_threshold || 20; // seconds
    const shrinkage = channel.shrinkage_factor || 0.25;

    // Calculate workload in Erlangs (hours)
    const totalHandleTime = aht + wrapUpTime;
    const workloadErlangs = (volume * totalHandleTime) / 60;

    // Apply shrinkage
    const adjustedWorkload = workloadErlangs / (1 - shrinkage);

    // Basic staffing calculation
    const baseAgents = Math.ceil(adjustedWorkload);
    
    // Add buffer for service level
    const bufferFactor = this.calculateServiceLevelBuffer(serviceLevel, targetAnswerTime);
    const requiredAgents = Math.max(channel.min_staffing_level || 1, Math.ceil(baseAgents * bufferFactor));
    
    // Calculate optimal (with efficiency buffer)
    const optimalAgents = Math.ceil(requiredAgents * (1 + (channel.preferred_staffing_buffer || 0.10)));
    
    // Minimum is channel minimum or 1
    const minimumAgents = channel.min_staffing_level || 1;

    // Predict service level and wait time
    const predictedServiceLevel = this.predictServiceLevel(requiredAgents, workloadErlangs, targetAnswerTime);
    const predictedWaitTime = this.predictAverageWaitTime(requiredAgents, workloadErlangs);

    return {
      required: requiredAgents,
      optimal: optimalAgents,
      minimum: minimumAgents,
      predictedServiceLevel,
      predictedWaitTime,
    };
  }

  /**
   * Get historical data for forecasting
   */
  async getHistoricalData(channelId, hour, skillId = null, lookbackDays = 28) {
    try {
      const endDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(lookbackDays, 'days').format('YYYY-MM-DD');

      const where = {
        channel_id: channelId,
        forecast_hour: hour,
        forecast_date: {
          [require('sequelize').Op.between]: [startDate, endDate],
        },
        actual_volume: {
          [require('sequelize').Op.not]: null,
        },
      };

      if (skillId) {
        where.skill_id = skillId;
      }

      const historicalForecasts = await Forecast.findAll({
        where,
        attributes: ['forecast_date', 'actual_volume', 'forecast_hour'],
        order: [['forecast_date', 'DESC']],
      });

      return historicalForecasts.map(f => ({
        date: f.forecast_date,
        volume: f.actual_volume,
        hour: f.forecast_hour,
      }));

    } catch (error) {
      logger.error('Error fetching historical data:', error);
      return [];
    }
  }

  /**
   * Calculate seasonal and trend factors
   */
  async getSeasonalFactors(date, hour) {
    const momentDate = moment(date);
    const dayOfWeek = momentDate.day(); // 0 = Sunday
    const month = momentDate.month(); // 0 = January
    const dayOfMonth = momentDate.date();

    // Day of week seasonality (Monday = highest, Friday = high for end-of-week, weekends lower)
    const dayOfWeekFactors = [0.6, 1.1, 1.0, 1.0, 1.2, 1.1, 0.7]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    const seasonal = dayOfWeekFactors[dayOfWeek];

    // Hour of day seasonality (typical business hours pattern)
    const hourFactors = [
      0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.5, 0.7, // 00-07
      1.0, 1.2, 1.1, 1.0, 0.9, 1.1, 1.2, 1.1, // 08-15
      1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1, 0.1  // 16-23
    ];
    const hourlyFactor = hourFactors[hour];

    // Monthly seasonality (some months busier than others)
    const monthlyFactors = [
      1.1, 1.0, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8, // Jan-Aug
      1.0, 1.1, 1.2, 1.3 // Sep-Dec (holiday season)
    ];
    const monthlyFactor = monthlyFactors[month];

    // Simple trend (assuming slight growth)
    const trend = 1.02; // 2% growth trend

    return {
      seasonal: seasonal * hourlyFactor * monthlyFactor,
      trend,
    };
  }

  /**
   * Get external factors affecting volume
   */
  async getExternalFactors(date, hour) {
    const momentDate = moment(date);
    
    // Check for holidays
    const holidayFactor = this.getHolidayFactor(momentDate);
    
    // Weather factor (simplified - would integrate with weather API in production)
    const weatherFactor = 1.0;
    
    // Special events (simplified - would integrate with calendar/events)
    const specialEvent = 1.0;

    return {
      holidayFactor,
      weather: weatherFactor,
      specialEvent,
    };
  }

  /**
   * Check if hour is within operating hours for channel
   */
  isOperatingHour(hour, channel) {
    const startHour = parseInt(channel.operating_hours_start.split(':')[0]);
    const endHour = parseInt(channel.operating_hours_end.split(':')[0]);
    
    return hour >= startHour && hour < endHour;
  }

  /**
   * Update hourly forecasts (called by cron job)
   */
  async updateHourlyForecasts() {
    try {
      const channels = await Channel.findAll({ where: { is_active: true } });
      const today = moment().format('YYYY-MM-DD');
      const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');

      for (const channel of channels) {
        // Update today's remaining hours
        await this.generateHourlyForecasts(channel.id, today);
        
        // Generate tomorrow's forecasts
        await this.generateHourlyForecasts(channel.id, tomorrow);
      }

      logger.info('Hourly forecast update completed');
    } catch (error) {
      logger.error('Error updating hourly forecasts:', error);
    }
  }

  /**
   * Utility methods
   */
  calculateVariance(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  calculateServiceLevelBuffer(serviceLevel, targetAnswerTime) {
    // Higher service levels need more agents
    return 1 + (serviceLevel - 0.5) * 0.5;
  }

  predictServiceLevel(agents, workload, targetSeconds) {
    // Simplified service level prediction
    const utilization = workload / agents;
    if (utilization >= 1) return 0.1; // Overloaded
    
    return Math.max(0.1, Math.min(0.99, 1 - utilization));
  }

  predictAverageWaitTime(agents, workload) {
    // Simplified wait time prediction in seconds
    const utilization = workload / agents;
    if (utilization >= 1) return 300; // 5 minutes when overloaded
    
    return Math.max(0, utilization * 60); // Increases with utilization
  }

  getHolidayFactor(momentDate) {
    // Simplified holiday detection
    const month = momentDate.month();
    const date = momentDate.date();
    
    // Major holidays reduce volume
    const holidays = [
      { month: 0, date: 1 },   // New Year's Day
      { month: 6, date: 4 },   // Independence Day
      { month: 11, date: 25 }, // Christmas
    ];
    
    for (const holiday of holidays) {
      if (month === holiday.month && date === holiday.date) {
        return 0.3; // 70% volume reduction
      }
    }
    
    return 1.0; // Normal day
  }
}

module.exports = new ForecastService(); 