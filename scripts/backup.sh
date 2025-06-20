#!/bin/bash

# Workforce Management Backup Script
# This script creates backups of the database and application data

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting backup process...${NC}"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Database backup
echo -e "${YELLOW}Creating database backup...${NC}"
if pg_dump -h postgres -U wfm_user -d workforce_management > $BACKUP_DIR/db_backup_$DATE.sql; then
    echo -e "${GREEN}Database backup completed: db_backup_$DATE.sql${NC}"
else
    echo -e "${RED}Database backup failed!${NC}"
    exit 1
fi

# Application data backup (uploads, logs, etc.)
echo -e "${YELLOW}Creating application data backup...${NC}"
if [ -d "/app/uploads" ] || [ -d "/app/logs" ]; then
    tar -czf $BACKUP_DIR/app_data_$DATE.tar.gz \
        -C /app \
        $([ -d "/app/uploads" ] && echo "uploads") \
        $([ -d "/app/logs" ] && echo "logs") 2>/dev/null || true
    echo -e "${GREEN}Application data backup completed: app_data_$DATE.tar.gz${NC}"
fi

# Cleanup old backups
echo -e "${YELLOW}Cleaning up old backups (keeping last $RETENTION_DAYS days)...${NC}"
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find $BACKUP_DIR -name "app_data_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Show backup summary
echo -e "${GREEN}Backup Summary:${NC}"
echo "Date: $DATE"
echo "Database backup: $(ls -lh $BACKUP_DIR/db_backup_$DATE.sql 2>/dev/null | awk '{print $5}' || echo 'N/A')"
echo "App data backup: $(ls -lh $BACKUP_DIR/app_data_$DATE.tar.gz 2>/dev/null | awk '{print $5}' || echo 'N/A')"
echo "Total backups: $(ls -1 $BACKUP_DIR/*.sql $BACKUP_DIR/*.tar.gz 2>/dev/null | wc -l)"

echo -e "${GREEN}Backup process completed successfully!${NC}" 