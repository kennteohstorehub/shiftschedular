# FREE DEPLOYMENT ENVIRONMENT CONFIGURATION

# Application
NODE_ENV=production
PORT=3000

# Supabase Database (FREE)
# Get these from your Supabase project dashboard
EXTERNAL_DB_HOST=db.your-project-ref.supabase.co
EXTERNAL_DB_PORT=5432
EXTERNAL_DB_NAME=postgres
EXTERNAL_DB_USER=postgres
EXTERNAL_DB_PASSWORD=your-supabase-password
DB_SSL=true

# Upstash Redis (FREE)
# Get these from your Upstash dashboard
EXTERNAL_REDIS_HOST=your-redis-name.upstash.io
EXTERNAL_REDIS_PORT=6379
EXTERNAL_REDIS_PASSWORD=your-upstash-password
REDIS_TLS=true

# Security Keys (GENERATE RANDOM VALUES)
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters
SESSION_SECRET=your-session-secret-key-minimum-32-characters

# Application Settings
DEFAULT_TIMEZONE=Asia/Singapore
ENABLE_REAL_TIME=true
ENABLE_NOTIFICATIONS=true
ENABLE_ANALYTICS=true

# Email Configuration (Optional - use free SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn-for-error-tracking 