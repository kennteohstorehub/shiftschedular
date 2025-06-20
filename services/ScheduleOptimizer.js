const moment = require('moment-timezone');
const { Schedule, Shift, Agent, Forecast, TimeOff, Channel } = require('../models');
const logger = require('../utils/logger');

class ScheduleOptimizer {
  constructor() {
    this.defaultTimezone = 'America/New_York';
  }

  /**
   * Generate optimized schedule for a given period
   */
  async generateOptimizedSchedule(scheduleData) {
    try {
      const {
        type,
        startDate,
        endDate,
        agentIds,
        channelIds,
        constraints = {},
        optimizationPreferences = {},
      } = scheduleData;

      logger.info(`Generating optimized ${type} schedule from ${startDate} to ${endDate}`);

      // Create the schedule record
      const schedule = await Schedule.create({
        type,
        start_date: startDate,
        end_date: endDate,
        constraints: { ...this.getDefaultConstraints(), ...constraints },
        optimization_preferences: { ...this.getDefaultOptimizationPreferences(), ...optimizationPreferences },
        status: 'draft',
      });

      // Get all required data
      const agents = await this.getAvailableAgents(agentIds, startDate, endDate);
      const forecasts = await this.getForecastData(channelIds, startDate, endDate);
      const timeOffRequests = await this.getTimeOffRequests(agentIds, startDate, endDate);

      // Generate shifts for each day
      const allShifts = [];
      const currentDate = moment(startDate);
      const endMoment = moment(endDate);

      while (currentDate.isSameOrBefore(endMoment)) {
        const dateString = currentDate.format('YYYY-MM-DD');
        
        const dailyShifts = await this.generateDailyShifts({
          date: dateString,
          agents,
          forecasts: forecasts.filter(f => f.forecast_date === dateString),
          timeOffRequests: timeOffRequests.filter(t => 
            dateString >= t.start_date && dateString <= t.end_date
          ),
          schedule,
          constraints: schedule.constraints,
        });

        allShifts.push(...dailyShifts);
        currentDate.add(1, 'day');
      }

      // Optimize the complete schedule
      const optimizedShifts = await this.optimizeSchedule(allShifts, schedule);

      // Save all shifts
      const savedShifts = [];
      for (const shiftData of optimizedShifts) {
        const shift = await Shift.create({
          ...shiftData,
          schedule_id: schedule.id,
        });
        savedShifts.push(shift);
      }

      // Calculate schedule metrics
      const metrics = await this.calculateScheduleMetrics(schedule, savedShifts);
      
      await schedule.update({
        service_level_achieved: metrics.serviceLevel,
        coverage_percentage: metrics.coverage,
        total_labor_cost: metrics.totalCost,
        status: 'generated',
      });

      logger.info(`Generated schedule with ${savedShifts.length} shifts`);
      return { schedule, shifts: savedShifts, metrics };

    } catch (error) {
      logger.error('Error generating optimized schedule:', error);
      throw error;
    }
  }

  /**
   * Generate shifts for a single day
   */
  async generateDailyShifts({ date, agents, forecasts, timeOffRequests, schedule, constraints }) {
    const shifts = [];
    const unavailableAgents = new Set(
      timeOffRequests
        .filter(t => t.status === 'approved')
        .map(t => t.agent_id)
    );

    // Get available agents for this day
    const availableAgents = agents.filter(agent => !unavailableAgents.has(agent.id));
    
    if (availableAgents.length === 0) {
      logger.warn(`No available agents for ${date}`);
      return shifts;
    }

    // Group forecasts by channel and hour
    const hourlyRequirements = this.calculateHourlyRequirements(forecasts);
    
    // Generate shift patterns based on requirements
    const shiftPatterns = this.generateShiftPatterns(hourlyRequirements, constraints);
    
    // Assign agents to shifts
    const assignments = this.assignAgentsToShifts(shiftPatterns, availableAgents, constraints);

    // Create shift objects
    for (const assignment of assignments) {
      shifts.push({
        agent_id: assignment.agentId,
        shift_date: date,
        start_time: assignment.startTime,
        end_time: assignment.endTime,
        primary_channel_id: assignment.primaryChannelId,
        secondary_channels: assignment.secondaryChannels || [],
        required_skills: assignment.requiredSkills || [],
        expected_volume: assignment.expectedVolume || 0,
        shift_type: assignment.shiftType || 'regular',
        breaks: this.generateBreaks(assignment.startTime, assignment.endTime, constraints),
        lunch_break: this.generateLunchBreak(assignment.startTime, assignment.endTime, constraints),
      });
    }

    return shifts;
  }

  /**
   * Calculate hourly staffing requirements from forecasts
   */
  calculateHourlyRequirements(forecasts) {
    const requirements = {};
    
    for (const forecast of forecasts) {
      const hour = forecast.forecast_hour;
      
      if (!requirements[hour]) {
        requirements[hour] = {
          totalAgents: 0,
          channels: {},
          totalVolume: 0,
        };
      }
      
      requirements[hour].totalAgents += forecast.required_agents || 0;
      requirements[hour].totalVolume += forecast.predicted_volume || 0;
      requirements[hour].channels[forecast.channel_id] = {
        agents: forecast.required_agents || 0,
        volume: forecast.predicted_volume || 0,
      };
    }
    
    return requirements;
  }

  /**
   * Generate shift patterns based on requirements
   */
  generateShiftPatterns(hourlyRequirements, constraints) {
    const patterns = [];
    const maxHoursPerDay = constraints.max_hours_per_day || 8;
    const minShiftLength = 4; // minimum 4-hour shifts
    
    // Find peak hours
    const peakHours = this.findPeakHours(hourlyRequirements);
    
    // Generate standard 8-hour shifts covering peak periods
    const standardShifts = [
      { start: '08:00', end: '16:00', type: 'morning' },
      { start: '09:00', end: '17:00', type: 'day' },
      { start: '10:00', end: '18:00', type: 'day' },
      { start: '12:00', end: '20:00', type: 'afternoon' },
      { start: '14:00', end: '22:00', type: 'evening' },
    ];

    // Add part-time shifts for coverage gaps
    const partTimeShifts = [
      { start: '08:00', end: '12:00', type: 'part_time' },
      { start: '13:00', end: '17:00', type: 'part_time' },
      { start: '18:00', end: '22:00', type: 'part_time' },
    ];

    // Combine and prioritize shifts
    patterns.push(...standardShifts);
    patterns.push(...partTimeShifts);

    return patterns.map(pattern => ({
      ...pattern,
      priority: this.calculateShiftPriority(pattern, peakHours),
    })).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Assign agents to shifts using optimization algorithm
   */
  assignAgentsToShifts(shiftPatterns, availableAgents, constraints) {
    const assignments = [];
    const agentWorkload = new Map();
    
    // Initialize agent workload tracking
    availableAgents.forEach(agent => {
      agentWorkload.set(agent.id, {
        hoursAssigned: 0,
        shiftsAssigned: 0,
        lastShiftEnd: null,
      });
    });

    // Sort agents by suitability (consider skills, preferences, performance)
    const sortedAgents = this.sortAgentsBySuitability(availableAgents);

    // Assign shifts in priority order
    for (const pattern of shiftPatterns) {
      const suitableAgents = this.findSuitableAgents(
        sortedAgents,
        pattern,
        agentWorkload,
        constraints
      );

      if (suitableAgents.length > 0) {
        const selectedAgent = suitableAgents[0];
        const workload = agentWorkload.get(selectedAgent.id);
        
        // Calculate shift details
        const shiftHours = this.calculateShiftHours(pattern.start, pattern.end);
        
        assignments.push({
          agentId: selectedAgent.id,
          startTime: pattern.start,
          endTime: pattern.end,
          shiftType: shiftHours > 8 ? 'overtime' : 'regular',
          primaryChannelId: this.selectPrimaryChannel(selectedAgent, pattern),
          secondaryChannels: this.selectSecondaryChannels(selectedAgent, pattern),
          requiredSkills: this.getRequiredSkills(selectedAgent, pattern),
          expectedVolume: this.calculateExpectedVolume(pattern),
        });

        // Update agent workload
        workload.hoursAssigned += shiftHours;
        workload.shiftsAssigned += 1;
        workload.lastShiftEnd = pattern.end;
      }
    }

    return assignments;
  }

  /**
   * Optimize the complete schedule using various algorithms
   */
  async optimizeSchedule(shifts, schedule) {
    const preferences = schedule.optimization_preferences;
    let optimizedShifts = [...shifts];

    // Apply different optimization strategies
    if (preferences.balance_workload) {
      optimizedShifts = this.balanceWorkload(optimizedShifts);
    }

    if (preferences.minimize_overtime) {
      optimizedShifts = this.minimizeOvertime(optimizedShifts);
    }

    if (preferences.prioritize_agent_preferences) {
      optimizedShifts = await this.optimizeForAgentPreferences(optimizedShifts);
    }

    if (preferences.optimize_for_service_level) {
      optimizedShifts = this.optimizeForServiceLevel(optimizedShifts);
    }

    return optimizedShifts;
  }

  /**
   * Daily schedule optimization (called by cron job)
   */
  async optimizeDailySchedules() {
    try {
      const today = moment().format('YYYY-MM-DD');
      const activeSchedules = await Schedule.findAll({
        where: {
          status: ['active', 'published'],
          start_date: { [require('sequelize').Op.lte]: today },
          end_date: { [require('sequelize').Op.gte]: today },
        },
      });

      for (const schedule of activeSchedules) {
        await this.optimizeIntraday(schedule, today);
      }

      logger.info('Daily schedule optimization completed');
    } catch (error) {
      logger.error('Error in daily schedule optimization:', error);
    }
  }

  /**
   * Intraday optimization for real-time adjustments
   */
  async optimizeIntraday(schedule, date) {
    const shifts = await Shift.findAll({
      where: {
        schedule_id: schedule.id,
        shift_date: date,
        status: ['scheduled', 'confirmed', 'in_progress'],
      },
    });

    // Get current actual vs forecast
    const forecasts = await Forecast.findAll({
      where: {
        forecast_date: date,
        status: ['published', 'approved'],
      },
    });

    // Identify optimization opportunities
    const optimizations = this.identifyOptimizationOpportunities(shifts, forecasts);

    // Apply optimizations
    for (const optimization of optimizations) {
      await this.applyOptimization(optimization);
    }
  }

  /**
   * Utility methods
   */
  getDefaultConstraints() {
    return {
      max_consecutive_days: 5,
      min_days_off_per_week: 2,
      max_hours_per_day: 8,
      max_hours_per_week: 40,
      min_break_duration: 30,
      lunch_break_duration: 60,
      min_time_between_shifts: 8,
    };
  }

  getDefaultOptimizationPreferences() {
    return {
      prioritize_agent_preferences: true,
      minimize_overtime: true,
      balance_workload: true,
      optimize_for_service_level: true,
      allow_split_shifts: false,
    };
  }

  async getAvailableAgents(agentIds, startDate, endDate) {
    const where = {
      status: 'active',
    };
    
    if (agentIds && agentIds.length > 0) {
      where.id = agentIds;
    }

    return Agent.findAll({ where });
  }

  async getForecastData(channelIds, startDate, endDate) {
    const where = {
      forecast_date: {
        [require('sequelize').Op.between]: [startDate, endDate],
      },
      status: ['published', 'approved'],
    };

    if (channelIds && channelIds.length > 0) {
      where.channel_id = channelIds;
    }

    return Forecast.findAll({ where });
  }

  async getTimeOffRequests(agentIds, startDate, endDate) {
    const where = {
      status: ['approved', 'pending_approval'],
      [require('sequelize').Op.or]: [
        {
          start_date: {
            [require('sequelize').Op.between]: [startDate, endDate],
          },
        },
        {
          end_date: {
            [require('sequelize').Op.between]: [startDate, endDate],
          },
        },
        {
          [require('sequelize').Op.and]: [
            { start_date: { [require('sequelize').Op.lte]: startDate } },
            { end_date: { [require('sequelize').Op.gte]: endDate } },
          ],
        },
      ],
    };

    if (agentIds && agentIds.length > 0) {
      where.agent_id = agentIds;
    }

    return require('../models').TimeOff.findAll({ where });
  }

  findPeakHours(hourlyRequirements) {
    const hours = Object.keys(hourlyRequirements);
    return hours
      .sort((a, b) => hourlyRequirements[b].totalAgents - hourlyRequirements[a].totalAgents)
      .slice(0, Math.ceil(hours.length * 0.3)); // Top 30% of hours
  }

  calculateShiftPriority(pattern, peakHours) {
    const shiftStart = parseInt(pattern.start.split(':')[0]);
    const shiftEnd = parseInt(pattern.end.split(':')[0]);
    
    // Calculate overlap with peak hours
    const overlapHours = peakHours.filter(hour => 
      parseInt(hour) >= shiftStart && parseInt(hour) < shiftEnd
    ).length;
    
    return overlapHours;
  }

  sortAgentsBySuitability(agents) {
    return agents.sort((a, b) => {
      // Sort by performance metrics, flexibility, etc.
      const aScore = (a.customer_satisfaction_score || 3) + 
                    (a.first_call_resolution_rate || 0.5) +
                    (a.can_work_weekends ? 0.2 : 0) +
                    (a.overtime_eligible ? 0.1 : 0);
      
      const bScore = (b.customer_satisfaction_score || 3) + 
                    (b.first_call_resolution_rate || 0.5) +
                    (b.can_work_weekends ? 0.2 : 0) +
                    (b.overtime_eligible ? 0.1 : 0);
      
      return bScore - aScore;
    });
  }

  findSuitableAgents(agents, pattern, agentWorkload, constraints) {
    return agents.filter(agent => {
      const workload = agentWorkload.get(agent.id);
      const shiftHours = this.calculateShiftHours(pattern.start, pattern.end);
      
      // Check hour constraints
      if (workload.hoursAssigned + shiftHours > constraints.max_hours_per_week) {
        return false;
      }
      
      // Check time between shifts
      if (workload.lastShiftEnd) {
        const timeBetween = this.calculateTimeBetween(workload.lastShiftEnd, pattern.start);
        if (timeBetween < constraints.min_time_between_shifts) {
          return false;
        }
      }
      
      return true;
    });
  }

  calculateShiftHours(startTime, endTime) {
    const start = moment(`2000-01-01T${startTime}`);
    const end = moment(`2000-01-01T${endTime}`);
    return end.diff(start, 'hours', true);
  }

  calculateTimeBetween(endTime, startTime) {
    const end = moment(`2000-01-01T${endTime}`);
    const start = moment(`2000-01-02T${startTime}`); // Next day
    return start.diff(end, 'hours', true);
  }

  selectPrimaryChannel(agent, pattern) {
    // Logic to select primary channel based on agent skills and pattern
    return null; // Placeholder
  }

  selectSecondaryChannels(agent, pattern) {
    // Logic to select secondary channels
    return [];
  }

  getRequiredSkills(agent, pattern) {
    // Logic to determine required skills
    return [];
  }

  calculateExpectedVolume(pattern) {
    // Calculate expected volume for the shift pattern
    return 0;
  }

  generateBreaks(startTime, endTime, constraints) {
    const shiftHours = this.calculateShiftHours(startTime, endTime);
    const breaks = [];
    
    if (shiftHours >= 4) {
      // 15-minute break every 4 hours
      const breakDuration = constraints.min_break_duration || 15;
      const numBreaks = Math.floor(shiftHours / 4);
      
      for (let i = 1; i <= numBreaks; i++) {
        const breakTime = moment(`2000-01-01T${startTime}`)
          .add(i * 4, 'hours')
          .format('HH:mm');
        
        breaks.push({
          start_time: breakTime,
          end_time: moment(`2000-01-01T${breakTime}`)
            .add(breakDuration, 'minutes')
            .format('HH:mm'),
          type: 'break',
          duration: breakDuration,
        });
      }
    }
    
    return breaks;
  }

  generateLunchBreak(startTime, endTime, constraints) {
    const shiftHours = this.calculateShiftHours(startTime, endTime);
    
    if (shiftHours >= 6) {
      const lunchDuration = constraints.lunch_break_duration || 60;
      const midShift = moment(`2000-01-01T${startTime}`)
        .add(shiftHours / 2, 'hours')
        .format('HH:mm');
      
      return {
        start_time: midShift,
        end_time: moment(`2000-01-01T${midShift}`)
          .add(lunchDuration, 'minutes')
          .format('HH:mm'),
        type: 'lunch',
        duration: lunchDuration,
      };
    }
    
    return null;
  }

  async calculateScheduleMetrics(schedule, shifts) {
    // Calculate various metrics for the schedule
    const totalCost = shifts.reduce((sum, shift) => sum + (shift.total_cost || 0), 0);
    
    return {
      serviceLevel: 0.85, // Placeholder
      coverage: 0.90, // Placeholder
      totalCost,
      efficiency: 0.88, // Placeholder
    };
  }

  // Additional optimization methods
  balanceWorkload(shifts) {
    // Implementation for workload balancing
    return shifts;
  }

  minimizeOvertime(shifts) {
    // Implementation for overtime minimization
    return shifts;
  }

  async optimizeForAgentPreferences(shifts) {
    // Implementation for agent preference optimization
    return shifts;
  }

  optimizeForServiceLevel(shifts) {
    // Implementation for service level optimization
    return shifts;
  }

  identifyOptimizationOpportunities(shifts, forecasts) {
    // Identify real-time optimization opportunities
    return [];
  }

  async applyOptimization(optimization) {
    // Apply specific optimization
    return;
  }
}

module.exports = new ScheduleOptimizer(); 