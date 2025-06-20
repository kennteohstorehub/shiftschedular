const { sequelize, User, Agent, Channel, Skill, Schedule, Shift, TimeOff, Forecast } = require('../models');
const bcrypt = require('bcryptjs');
const moment = require('moment-timezone');
const logger = require('../utils/logger');

class DatabaseSeeder {
  constructor() {
    this.users = [];
    this.agents = [];
    this.channels = [];
    this.skills = [];
  }

  async run() {
    try {
      logger.info('Starting database seeding...');

      // Sync database
      await sequelize.sync({ force: true });
      logger.info('Database synced');

      // Seed in order due to dependencies
      await this.seedUsers();
      await this.seedAgents();
      await this.seedChannels();
      await this.seedSkills();
      await this.linkAgentSkills();
      await this.linkAgentChannels();
      await this.seedForecasts();
      await this.seedTimeOffRequests();
      await this.seedSchedules();

      logger.info('Database seeding completed successfully');

    } catch (error) {
      logger.error('Error seeding database:', error);
      throw error;
    }
  }

  async seedUsers() {
    const userData = [
      {
        username: 'admin',
        email: 'admin@shiftadjuster.com',
        password_hash: 'admin123',
        first_name: 'System',
        last_name: 'Administrator',
        role: 'admin',
      },
      {
        username: 'manager1',
        email: 'manager@shiftadjuster.com',
        password_hash: 'manager123',
        first_name: 'Sarah',
        last_name: 'Johnson',
        role: 'manager',
      },
      {
        username: 'supervisor1',
        email: 'supervisor1@shiftadjuster.com',
        password_hash: 'supervisor123',
        first_name: 'Mike',
        last_name: 'Chen',
        role: 'supervisor',
      },
      {
        username: 'supervisor2',
        email: 'supervisor2@shiftadjuster.com',
        password_hash: 'supervisor123',
        first_name: 'Lisa',
        last_name: 'Rodriguez',
        role: 'supervisor',
      },
    ];

    // Add agent users
    const agentNames = [
      { first: 'John', last: 'Smith' },
      { first: 'Emily', last: 'Davis' },
      { first: 'David', last: 'Wilson' },
      { first: 'Jessica', last: 'Brown' },
      { first: 'Michael', last: 'Jones' },
      { first: 'Ashley', last: 'Miller' },
      { first: 'Chris', last: 'Garcia' },
      { first: 'Amanda', last: 'Martinez' },
      { first: 'Ryan', last: 'Anderson' },
      { first: 'Michelle', last: 'Taylor' },
      { first: 'Kevin', last: 'Thomas' },
      { first: 'Stephanie', last: 'Moore' },
    ];

    for (let i = 0; i < agentNames.length; i++) {
      const agent = agentNames[i];
      userData.push({
        username: `agent${i + 1}`,
        email: `${agent.first.toLowerCase()}.${agent.last.toLowerCase()}@shiftadjuster.com`,
        password_hash: 'agent123',
        first_name: agent.first,
        last_name: agent.last,
        role: 'agent',
      });
    }

    this.users = await User.bulkCreate(userData);
    logger.info(`Seeded ${this.users.length} users`);
  }

  async seedAgents() {
    // Get agent users (skip admin, manager, supervisors)
    const agentUsers = this.users.filter(user => user.role === 'agent');
    
    const agentData = agentUsers.map((user, index) => ({
      user_id: user.id,
      employee_id: `EMP${String(index + 1).padStart(3, '0')}`,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: `555-0${String(index + 100)}`,
      hire_date: moment().subtract(Math.floor(Math.random() * 365), 'days').format('YYYY-MM-DD'),
      employment_type: Math.random() > 0.8 ? 'part_time' : 'full_time',
      shift_pattern: ['fixed', 'rotating', 'flexible'][Math.floor(Math.random() * 3)],
      average_handle_time: 4 + Math.random() * 4, // 4-8 minutes
      first_call_resolution_rate: 0.75 + Math.random() * 0.2, // 75-95%
      customer_satisfaction_score: 3.5 + Math.random() * 1.5, // 3.5-5.0
      preferred_start_time: ['08:00:00', '09:00:00', '10:00:00'][Math.floor(Math.random() * 3)],
      preferred_end_time: ['16:00:00', '17:00:00', '18:00:00'][Math.floor(Math.random() * 3)],
      max_hours_per_week: Math.random() > 0.8 ? 32 : 40, // Some part-time
      can_work_weekends: Math.random() > 0.6,
      can_work_holidays: Math.random() > 0.7,
      overtime_eligible: Math.random() > 0.2,
      certification_level: ['junior', 'senior', 'expert'][Math.floor(Math.random() * 3)],
    }));

    this.agents = await Agent.bulkCreate(agentData);
    logger.info(`Seeded ${this.agents.length} agents`);
  }

  async seedChannels() {
    const channelData = [
      {
        name: 'inbound_calls',
        display_name: 'Inbound Calls',
        type: 'voice_inbound',
        description: 'Customer service inbound phone calls',
        service_level_threshold: 20, // 20 seconds
        service_level_target: 0.80, // 80%
        average_handle_time: 6.5,
        wrap_up_time: 2.0,
        max_concurrent_interactions: 1,
        shrinkage_factor: 0.25,
        operating_hours_start: '08:00:00',
        operating_hours_end: '20:00:00',
        min_staffing_level: 2,
        preferred_staffing_buffer: 0.15,
      },
      {
        name: 'outbound_calls',
        display_name: 'Outbound Calls',
        type: 'voice_outbound',
        description: 'Customer follow-up and sales calls',
        service_level_threshold: 30,
        service_level_target: 0.75,
        average_handle_time: 8.0,
        wrap_up_time: 3.0,
        max_concurrent_interactions: 1,
        shrinkage_factor: 0.20,
        operating_hours_start: '09:00:00',
        operating_hours_end: '17:00:00',
        min_staffing_level: 1,
        preferred_staffing_buffer: 0.10,
      },
      {
        name: 'live_chat',
        display_name: 'Live Chat',
        type: 'chat',
        description: 'Website live chat support',
        service_level_threshold: 30,
        service_level_target: 0.85,
        average_handle_time: 12.0,
        wrap_up_time: 1.0,
        max_concurrent_interactions: 3,
        shrinkage_factor: 0.20,
        operating_hours_start: '08:00:00',
        operating_hours_end: '22:00:00',
        min_staffing_level: 1,
        preferred_staffing_buffer: 0.20,
      },
      {
        name: 'email_support',
        display_name: 'Email Support',
        type: 'email',
        description: 'Customer email inquiries and support',
        service_level_threshold: 14400, // 4 hours
        service_level_target: 0.90,
        average_handle_time: 15.0,
        wrap_up_time: 2.0,
        max_concurrent_interactions: 5,
        shrinkage_factor: 0.15,
        operating_hours_start: '08:00:00',
        operating_hours_end: '18:00:00',
        min_staffing_level: 1,
        preferred_staffing_buffer: 0.10,
      },
    ];

    this.channels = await Channel.bulkCreate(channelData);
    logger.info(`Seeded ${this.channels.length} channels`);
  }

  async seedSkills() {
    const skillData = [
      {
        name: 'customer_service',
        display_name: 'Customer Service',
        category: 'soft_skill',
        description: 'General customer service skills',
        priority: 1,
        certification_required: false,
        training_hours_required: 20,
      },
      {
        name: 'technical_support',
        display_name: 'Technical Support',
        category: 'technical',
        description: 'Technical troubleshooting and support',
        priority: 2,
        certification_required: true,
        training_hours_required: 40,
        minimum_proficiency_required: 'intermediate',
      },
      {
        name: 'sales',
        display_name: 'Sales',
        category: 'specialized',
        description: 'Sales and upselling skills',
        priority: 3,
        certification_required: false,
        training_hours_required: 30,
      },
      {
        name: 'billing_support',
        display_name: 'Billing Support',
        category: 'product',
        description: 'Billing and payment related inquiries',
        priority: 2,
        certification_required: true,
        training_hours_required: 25,
      },
      {
        name: 'spanish',
        display_name: 'Spanish Language',
        category: 'language',
        description: 'Spanish language proficiency',
        priority: 4,
        certification_required: false,
        training_hours_required: 0,
        minimum_proficiency_required: 'advanced',
      },
      {
        name: 'chat_support',
        display_name: 'Chat Support',
        category: 'technical',
        description: 'Live chat communication skills',
        priority: 2,
        certification_required: false,
        training_hours_required: 15,
      },
    ];

    this.skills = await Skill.bulkCreate(skillData);
    logger.info(`Seeded ${this.skills.length} skills`);
  }

  async linkAgentSkills() {
    // Assign random skills to agents
    for (const agent of this.agents) {
      const numSkills = 2 + Math.floor(Math.random() * 3); // 2-4 skills per agent
      const selectedSkills = this.skills
        .sort(() => 0.5 - Math.random())
        .slice(0, numSkills);
      
      await agent.setSkills(selectedSkills);
    }
    logger.info('Linked agents to skills');
  }

  async linkAgentChannels() {
    // Assign agents to channels based on their skills
    for (const agent of this.agents) {
      const assignedChannels = [];
      
      // All agents can handle inbound calls and email
      assignedChannels.push(
        this.channels.find(c => c.name === 'inbound_calls'),
        this.channels.find(c => c.name === 'email_support')
      );
      
      // Random assignment to other channels
      if (Math.random() > 0.4) {
        assignedChannels.push(this.channels.find(c => c.name === 'live_chat'));
      }
      
      if (Math.random() > 0.6) {
        assignedChannels.push(this.channels.find(c => c.name === 'outbound_calls'));
      }
      
      await agent.setChannels(assignedChannels);
    }
    logger.info('Linked agents to channels');
  }

  async seedForecasts() {
    const startDate = moment().subtract(7, 'days');
    const endDate = moment().add(7, 'days');
    const forecastData = [];

    // Generate forecasts for each channel and day
    for (const channel of this.channels) {
      const currentDate = moment(startDate);
      
      while (currentDate.isSameOrBefore(endDate)) {
        const dateString = currentDate.format('YYYY-MM-DD');
        
        // Generate hourly forecasts during operating hours
        const startHour = parseInt(channel.operating_hours_start.split(':')[0]);
        const endHour = parseInt(channel.operating_hours_end.split(':')[0]);
        
        for (let hour = startHour; hour < endHour; hour++) {
          const baseVolume = this.getBaseVolumeForChannel(channel.type, hour);
          const dayFactor = this.getDayOfWeekFactor(currentDate.day());
          const hourFactor = this.getHourOfDayFactor(hour);
          
          const predictedVolume = Math.round(baseVolume * dayFactor * hourFactor);
          const requiredAgents = Math.max(1, Math.ceil(predictedVolume / 10)); // Simplified calculation
          
          forecastData.push({
            channel_id: channel.id,
            forecast_date: dateString,
            forecast_hour: hour,
            forecast_type: 'hourly',
            forecast_method: 'historical_average',
            predicted_volume: predictedVolume,
            confidence_level: 0.75 + Math.random() * 0.2,
            min_volume: Math.max(0, predictedVolume - Math.floor(predictedVolume * 0.3)),
            max_volume: predictedVolume + Math.floor(predictedVolume * 0.4),
            required_agents: requiredAgents,
            optimal_agents: requiredAgents + 1,
            minimum_agents: Math.max(1, requiredAgents - 1),
            predicted_service_level: 0.80 + Math.random() * 0.15,
            predicted_average_wait_time: 10 + Math.random() * 20,
            seasonal_factor: dayFactor,
            trend_factor: 1.0,
            special_event_factor: 1.0,
            weather_factor: 1.0,
            status: currentDate.isBefore(moment()) ? 'published' : 'generated',
            model_version: '1.0.0',
            created_by: 'system',
          });
        }
        
        currentDate.add(1, 'day');
      }
    }

    await Forecast.bulkCreate(forecastData);
    logger.info(`Seeded ${forecastData.length} forecasts`);
  }

  async seedTimeOffRequests() {
    const timeOffData = [];
    
    // Create some time off requests for agents
    const selectedAgents = this.agents.slice(0, 6); // First 6 agents
    
    for (let i = 0; i < selectedAgents.length; i++) {
      const agent = selectedAgents[i];
      
      // Past approved vacation
      timeOffData.push({
        agent_id: agent.id,
        start_date: moment().subtract(10 + i, 'days').format('YYYY-MM-DD'),
        end_date: moment().subtract(8 + i, 'days').format('YYYY-MM-DD'),
        type: 'vacation',
        category: 'paid',
        reason: 'Annual vacation',
        status: 'approved',
        approval_status: 'approved',
        priority: 'normal',
        coverage_required: true,
        coverage_arranged: true,
        hours_requested: 16, // 2 days * 8 hours
        hours_approved: 16,
        approved_by: this.users.find(u => u.role === 'manager').id,
        approved_at: moment().subtract(15 + i, 'days').toDate(),
        created_by: agent.user_id,
      });
      
      // Future pending request
      if (i < 3) {
        timeOffData.push({
          agent_id: agent.id,
          start_date: moment().add(5 + i, 'days').format('YYYY-MM-DD'),
          end_date: moment().add(5 + i, 'days').format('YYYY-MM-DD'),
          type: 'personal_leave',
          category: 'paid',
          reason: 'Personal appointment',
          status: 'pending_approval',
          approval_status: 'pending',
          priority: 'normal',
          coverage_required: true,
          coverage_arranged: false,
          hours_requested: 8,
          is_partial_day: false,
          created_by: agent.user_id,
        });
      }
    }

    await TimeOff.bulkCreate(timeOffData);
    logger.info(`Seeded ${timeOffData.length} time off requests`);
  }

  async seedSchedules() {
    // Create a current week schedule
    const startOfWeek = moment().startOf('week');
    const endOfWeek = moment().endOf('week');
    
    const schedule = await Schedule.create({
      name: `Week of ${startOfWeek.format('YYYY-MM-DD')}`,
      type: 'weekly',
      start_date: startOfWeek.format('YYYY-MM-DD'),
      end_date: endOfWeek.format('YYYY-MM-DD'),
      status: 'active',
      created_by: this.users.find(u => u.role === 'manager').id,
      published_by: this.users.find(u => u.role === 'manager').id,
      published_at: moment().subtract(2, 'days').toDate(),
    });

    // Create some sample shifts for this week
    const shiftData = [];
    const workingAgents = this.agents.slice(0, 8); // Use first 8 agents
    
    for (let day = 0; day < 7; day++) {
      const currentDate = moment(startOfWeek).add(day, 'days');
      const dateString = currentDate.format('YYYY-MM-DD');
      
      // Skip weekends for most agents
      if (currentDate.day() === 0 || currentDate.day() === 6) {
        // Only 2 agents work weekends
        const weekendAgents = workingAgents.slice(0, 2);
        
        for (const agent of weekendAgents) {
          shiftData.push({
            schedule_id: schedule.id,
            agent_id: agent.id,
            shift_date: dateString,
            start_time: '10:00:00',
            end_time: '18:00:00',
            shift_type: 'regular',
            primary_channel_id: this.channels.find(c => c.name === 'inbound_calls').id,
            secondary_channels: [this.channels.find(c => c.name === 'email_support').id],
            breaks: [
              { start_time: '12:00:00', end_time: '12:15:00', type: 'break', duration: 15 },
              { start_time: '15:00:00', end_time: '15:15:00', type: 'break', duration: 15 },
            ],
            lunch_break: { start_time: '13:00:00', end_time: '14:00:00', type: 'lunch', duration: 60 },
            status: currentDate.isBefore(moment()) ? 'completed' : 'scheduled',
          });
        }
      } else {
        // Weekday shifts
        const shiftsNeeded = [
          { start: '08:00:00', end: '16:00:00', agents: 3 },
          { start: '09:00:00', end: '17:00:00', agents: 2 },
          { start: '12:00:00', end: '20:00:00', agents: 2 },
        ];

        let agentIndex = 0;
        for (const shiftPattern of shiftsNeeded) {
          for (let i = 0; i < shiftPattern.agents && agentIndex < workingAgents.length; i++) {
            const agent = workingAgents[agentIndex];
            
            shiftData.push({
              schedule_id: schedule.id,
              agent_id: agent.id,
              shift_date: dateString,
              start_time: shiftPattern.start,
              end_time: shiftPattern.end,
              shift_type: 'regular',
              primary_channel_id: this.channels[agentIndex % this.channels.length].id,
              secondary_channels: [this.channels[(agentIndex + 1) % this.channels.length].id],
              breaks: [
                { start_time: '10:30:00', end_time: '10:45:00', type: 'break', duration: 15 },
                { start_time: '15:30:00', end_time: '15:45:00', type: 'break', duration: 15 },
              ],
              lunch_break: { start_time: '12:30:00', end_time: '13:30:00', type: 'lunch', duration: 60 },
              status: currentDate.isBefore(moment()) ? 'completed' : 'scheduled',
            });
            
            agentIndex++;
          }
        }
      }
    }

    await Shift.bulkCreate(shiftData);
    logger.info(`Seeded schedule with ${shiftData.length} shifts`);
  }

  // Helper methods
  getBaseVolumeForChannel(channelType, hour) {
    const baseVolumes = {
      voice_inbound: 25,
      voice_outbound: 15,
      chat: 20,
      email: 30,
    };
    return baseVolumes[channelType] || 20;
  }

  getDayOfWeekFactor(dayOfWeek) {
    // 0 = Sunday, 6 = Saturday
    const factors = [0.5, 1.2, 1.1, 1.0, 1.1, 1.3, 0.7];
    return factors[dayOfWeek];
  }

  getHourOfDayFactor(hour) {
    // Business hours pattern
    if (hour < 8) return 0.2;
    if (hour < 10) return 0.8;
    if (hour < 12) return 1.2;
    if (hour < 14) return 0.9; // Lunch dip
    if (hour < 16) return 1.1;
    if (hour < 18) return 1.0;
    if (hour < 20) return 0.8;
    return 0.4;
  }
}

// Run seeder if called directly
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.run()
    .then(() => {
      logger.info('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseSeeder; 