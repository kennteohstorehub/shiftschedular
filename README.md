# ShiftAdjuster - Workforce Management System

A comprehensive workforce management solution designed specifically for customer service teams operating in omnichannel environments. Built with Node.js, this system handles scheduling, forecasting, and real-time management for teams of 9-15 agents across multiple communication channels.

## 🚀 Features

### Core Workforce Management
- **AI-Powered Forecasting**: Intelligent demand prediction using historical data, seasonal patterns, and external factors
- **Schedule Optimization**: Automated schedule generation with constraint-based optimization
- **Multi-Channel Support**: Omnichannel scheduling for voice (inbound/outbound), chat, email, and social media
- **Real-Time Intraday Management**: Live schedule adjustments and adherence monitoring

### Agent Self-Service
- **Mobile-First Interface**: Responsive design for on-the-go schedule management
- **Shift Swapping**: Peer-to-peer shift exchanges with approval workflows
- **Time-Off Requests**: Streamlined leave request process with automated coverage detection
- **Preference Management**: Agent availability and preference settings

### Management Tools
- **Adherence Tracking**: Real-time and historical adherence monitoring
- **Analytics Dashboard**: Comprehensive reporting on KPIs and performance metrics
- **Approval Workflows**: Multi-level approval processes for schedules and time-off
- **Skill-Based Routing**: Agent assignments based on skills and certifications

### Planning Horizons
- **Monthly Planning**: Strategic workforce planning and capacity management
- **Weekly Adjustments**: Tactical scheduling with leave accommodations
- **Daily Optimization**: Emergency coverage and real-time adjustments

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: SQLite (development) / PostgreSQL (production ready)
- **Real-Time**: WebSocket integration for live updates
- **Authentication**: JWT-based secure authentication
- **Scheduling**: Custom optimization algorithms with constraint solving
- **Logging**: Winston-based comprehensive logging

### System Components

#### Models
- **Agent**: Employee profiles with skills and availability
- **Channel**: Communication channels with service level requirements
- **Schedule**: Planning periods with optimization constraints
- **Shift**: Individual agent assignments with break scheduling
- **Forecast**: AI-generated volume and staffing predictions
- **TimeOff**: Leave requests and approval workflows
- **Adherence**: Real-time performance tracking

#### Services
- **ForecastService**: Demand prediction and volume forecasting
- **ScheduleOptimizer**: Intelligent schedule generation and optimization
- **Real-Time Engine**: Live monitoring and intraday adjustments

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- SQLite3 (included) or PostgreSQL for production

## ⚡ Quick Start

### Option 1: Docker (Recommended for Production & Multi-Manager Setup)

```bash
# Clone the repository
git clone https://github.com/kennteohstorehub/shiftschedular.git
cd shiftschedular

# Set up environment
cp env.example .env
# Edit .env with your configurations

# Start all services (PostgreSQL, Redis, Application, Nginx)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

The application will be available at `http://localhost:3000`

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/kennteohstorehub/shiftschedular.git
cd shiftschedular

# Install dependencies
npm install

# Create environment file
cp env.example .env

# Initialize database and seed sample data
npm run seed

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

### Default Users

After seeding, you can login with these default accounts:

- **Admin**: `admin` / `admin123`
- **Manager**: `manager1` / `manager123`
- **Supervisor**: `supervisor1` / `supervisor123`
- **Agent**: `agent1` / `agent123` (or agent2, agent3, etc.)

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=sqlite://database.sqlite

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Client Application
CLIENT_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

### Customization

#### Channel Configuration
Configure your communication channels in the seed data or through the API:

```javascript
{
  name: 'inbound_calls',
  type: 'voice_inbound',
  service_level_target: 0.80,
  service_level_threshold: 20,
  average_handle_time: 6.5,
  operating_hours_start: '08:00:00',
  operating_hours_end: '20:00:00'
}
```

#### Scheduling Constraints
Customize scheduling rules and constraints:

```javascript
{
  max_consecutive_days: 5,
  min_days_off_per_week: 2,
  max_hours_per_day: 8,
  max_hours_per_week: 40,
  min_break_duration: 30,
  lunch_break_duration: 60
}
```

## 📊 API Documentation

### Authentication Endpoints

```bash
POST /api/auth/login        # User login
POST /api/auth/register     # User registration
GET  /api/auth/me          # Get current user
PUT  /api/auth/profile     # Update profile
POST /api/auth/logout      # Logout
```

### Core Endpoints

```bash
# Agents
GET    /api/agents         # List agents
POST   /api/agents         # Create agent
GET    /api/agents/:id     # Get agent details
PUT    /api/agents/:id     # Update agent
DELETE /api/agents/:id     # Delete agent

# Schedules
GET    /api/schedules      # List schedules
POST   /api/schedules      # Create schedule
GET    /api/schedules/:id  # Get schedule details
PUT    /api/schedules/:id  # Update schedule

# Shifts
GET    /api/shifts         # List shifts
POST   /api/shifts         # Create shift
PUT    /api/shifts/:id     # Update shift
DELETE /api/shifts/:id     # Delete shift

# Forecasts
GET    /api/forecasts      # List forecasts
POST   /api/forecasts      # Generate forecast
PUT    /api/forecasts/:id  # Update forecast

# Analytics
GET    /api/analytics/dashboard      # Dashboard data
GET    /api/analytics/adherence     # Adherence metrics
GET    /api/analytics/performance   # Performance metrics
```

## 🔄 Scheduled Tasks

The system includes automated tasks for optimal operation:

- **Hourly**: Forecast updates and real-time data processing
- **Daily**: Schedule optimization and adherence calculations
- **Weekly**: Performance analytics and trend analysis

## 📈 Performance Considerations

### Optimization Features
- **Database Indexing**: Optimized queries for large datasets
- **Caching Strategy**: Redis integration ready for high-volume deployments
- **Batch Processing**: Efficient handling of bulk operations
- **Real-Time Updates**: WebSocket optimization for live data

### Scalability
- **Horizontal Scaling**: Stateless design for load balancing
- **Database Sharding**: Ready for multi-tenant deployments
- **Microservice Architecture**: Modular design for service separation

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:models
npm run test:services
npm run test:routes

# Coverage report
npm run test:coverage
```

## 🚀 Deployment

### Docker Deployment (Recommended)

For production deployment with shared database access for multiple managers:

1. **Build and Push Docker Image**
```bash
# Make build script executable
chmod +x build-and-push.sh

# Build and push to Docker Hub
./build-and-push.sh

# Or build locally
docker build -t kennteohstorehub/shiftadjuster:latest .
```

2. **Production Deployment**
```bash
# Use production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Or deploy to cloud providers
# See DEPLOYMENT.md for detailed instructions
```

3. **Access Management**
- **Shared Database**: PostgreSQL with real-time synchronization
- **Multi-Manager Access**: All 3 managers can access simultaneously
- **Real-time Updates**: WebSocket-based live collaboration
- **Cost**: ~$25-50/month for cloud hosting

### Traditional Server Setup

1. **Environment Configuration**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/dbname
JWT_SECRET=your-production-secret
```

2. **Database Setup**
```bash
# Run migrations
npm run migrate

# Seed production data
npm run seed:production
```

### Hosting Options for 3 Managers

1. **Cloud VPS** (Recommended)
   - DigitalOcean, Linode, Vultr
   - 2-4 vCPUs, 4-8GB RAM
   - Cost: $20-40/month

2. **Container Services**
   - AWS ECS, Google Cloud Run
   - Auto-scaling, managed infrastructure
   - Cost: $30-60/month

3. **Platform as a Service**
   - Heroku, Railway, Render
   - Simplified deployment
   - Cost: $25-50/month

See `DEPLOYMENT.md` for comprehensive deployment instructions.

3. **Start Production Server**
```bash
npm start
```

### Docker Deployment

```dockerfile
# Build image
docker build -t shift-adjuster .

# Run container
docker run -p 5000:5000 shift-adjuster
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Cross-origin request security
- **Helmet Integration**: Security headers and protection

## 📚 Best Practices Implementation

Based on comprehensive workforce management research, the system implements:

- **Erlang C Calculations**: Accurate staffing calculations
- **Shrinkage Management**: Comprehensive shrinkage factor handling
- **Service Level Optimization**: SLA-driven scheduling
- **Skill-Based Routing**: Intelligent agent assignment
- **Compliance Management**: Labor law and regulation adherence

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `/docs` folder
- Review the API documentation

## 🗺️ Roadmap

### Phase 1 (Current)
- ✅ Core WFM functionality
- ✅ Basic forecasting and scheduling
- ✅ Agent self-service features

### Phase 2 (Planned)
- [ ] Advanced ML forecasting models
- [ ] Mobile application
- [ ] Advanced analytics and reporting
- [ ] Integration with popular contact center platforms

### Phase 3 (Future)
- [ ] AI-powered optimization
- [ ] Predictive analytics
- [ ] Advanced compliance management
- [ ] Multi-tenant architecture

---

Built with ❤️ for customer service teams worldwide. 