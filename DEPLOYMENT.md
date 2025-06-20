# Workforce Management System - Deployment Guide

## Overview
This guide covers deploying the workforce management system using Docker containers for shared access by multiple managers.

## Architecture
- **Frontend**: React application (to be built)
- **Backend**: Node.js/Express API server
- **Database**: PostgreSQL (production) / SQLite (development)
- **Cache**: Redis for real-time features
- **Reverse Proxy**: Nginx for load balancing and security

## Prerequisites
- Docker and Docker Compose
- Domain name (for production deployment)
- SSL certificates (for HTTPS)

## Quick Start (Local Development)

### 1. Clone Repository
```bash
git clone https://github.com/kennteohstorehub/shiftschedular.git
cd shiftschedular
```

### 2. Environment Setup
```bash
# Copy environment file
cp env.example .env

# Edit .env file with your configurations
nano .env
```

### 3. Start Services
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 4. Access Application
- Application: http://localhost:3000
- Database: localhost:5432
- Redis: localhost:6379

## Production Deployment Options

### Option 1: Cloud VPS (Recommended for 3 managers)
**Providers**: DigitalOcean, Linode, Vultr, AWS EC2

**Specifications**:
- 2-4 vCPUs
- 4-8 GB RAM
- 50-100 GB SSD
- Cost: $20-40/month

**Setup Steps**:
1. Create VPS instance
2. Install Docker and Docker Compose
3. Configure firewall (ports 80, 443, 22)
4. Set up SSL certificates
5. Deploy application

### Option 2: Managed Container Service
**Providers**: AWS ECS, Google Cloud Run, Azure Container Instances

**Benefits**:
- Automatic scaling
- Managed infrastructure
- High availability
- Cost: $30-60/month

### Option 3: Platform as a Service (PaaS)
**Providers**: Heroku, Railway, Render

**Benefits**:
- Simplified deployment
- Automatic SSL
- Built-in monitoring
- Cost: $25-50/month

## Detailed Production Setup

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/shiftadjuster
cd /opt/shiftadjuster
```

### 2. Environment Configuration
```bash
# Create production environment file
cat > .env << EOF
NODE_ENV=production
PORT=3000

# Database
DB_PASSWORD=your_secure_db_password
DB_HOST=postgres
DB_PORT=5432
DB_NAME=workforce_management
DB_USER=wfm_user

# Redis
REDIS_PASSWORD=your_secure_redis_password
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=your_super_secure_jwt_secret_key_here
SESSION_SECRET=your_session_secret_key_here

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Application
DEFAULT_TIMEZONE=Asia/Singapore
ENABLE_REAL_TIME=true
ENABLE_NOTIFICATIONS=true
ENABLE_ANALYTICS=true
EOF
```

### 3. SSL Certificate Setup
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Create SSL directory
sudo mkdir -p /opt/shiftadjuster/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/shiftadjuster/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/shiftadjuster/ssl/
```

### 4. Production Docker Compose
Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: workforce_management
      POSTGRES_USER: wfm_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - wfm-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - wfm-network

  app:
    image: kennteohstorehub/shiftadjuster:latest
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: workforce_management
      DB_USER: wfm_user
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
    volumes:
      - app_logs:/app/logs
    networks:
      - wfm-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - wfm-network

volumes:
  postgres_data:
  redis_data:
  app_logs:

networks:
  wfm-network:
    driver: bridge
```

### 5. Deploy Application
```bash
# Pull latest image
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

## Data Synchronization for 3 Managers

### Real-time Collaboration Features
1. **WebSocket Integration**: Live updates when any manager makes changes
2. **Conflict Resolution**: Optimistic locking prevents data conflicts
3. **Audit Trail**: Track all changes with user attribution
4. **Role-based Access**: Different permission levels for managers

### Access Methods
1. **Web Browser**: Access via https://your-domain.com
2. **Mobile Responsive**: Works on tablets and phones
3. **API Access**: For integrations with other systems

## Monitoring and Maintenance

### Health Checks
```bash
# Check application health
curl http://localhost:3000/health

# Check database connection
docker-compose exec postgres pg_isready -U wfm_user

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### Backup Strategy
```bash
# Database backup
docker-compose exec postgres pg_dump -U wfm_user workforce_management > backup_$(date +%Y%m%d).sql

# Automated backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec -T postgres pg_dump -U wfm_user workforce_management > $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x backup.sh

# Add to crontab for daily backups
echo "0 2 * * * /opt/shiftadjuster/backup.sh" | crontab -
```

### Log Management
```bash
# View application logs
docker-compose logs -f app

# Rotate logs
docker-compose exec app logrotate /etc/logrotate.conf
```

## Security Considerations

### Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Regular Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d
```

### SSL Certificate Renewal
```bash
# Automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Troubleshooting

### Common Issues
1. **Database Connection**: Check environment variables
2. **Permission Errors**: Verify file ownership
3. **Port Conflicts**: Ensure ports are available
4. **SSL Issues**: Check certificate validity

### Useful Commands
```bash
# Restart services
docker-compose restart

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a

# Reset database (CAUTION: This will delete all data)
docker-compose down -v
docker-compose up -d
```

## Cost Estimation

### Monthly Costs (USD)
- **VPS Server**: $20-40
- **Domain Name**: $10-15/year
- **SSL Certificate**: Free (Let's Encrypt)
- **Backup Storage**: $5-10
- **Total**: $25-50/month

### Scaling Options
- **More Users**: Increase server resources
- **High Availability**: Add load balancer and multiple servers
- **Geographic Distribution**: Deploy in multiple regions

## Support and Maintenance

### Recommended Schedule
- **Daily**: Monitor logs and health checks
- **Weekly**: Review performance metrics
- **Monthly**: Update system packages and Docker images
- **Quarterly**: Review security settings and access logs

### Professional Support
Consider hiring a DevOps consultant for:
- Initial setup and configuration
- Security hardening
- Performance optimization
- Disaster recovery planning

## Next Steps

1. **Choose Deployment Option**: Select based on budget and requirements
2. **Set Up Infrastructure**: Follow the appropriate setup guide
3. **Configure DNS**: Point domain to your server
4. **Test Thoroughly**: Verify all features work correctly
5. **Train Managers**: Provide access credentials and training
6. **Monitor and Maintain**: Set up regular maintenance schedule 