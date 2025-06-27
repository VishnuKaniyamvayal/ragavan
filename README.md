# ragavan

A comprehensive database backup system npm package named **ragavan**.

## Features

- **Multi-Database Support**: MySQL, PostgreSQL, MongoDB
- **Today's Data Backup**: Automatically extracts data created/updated today
- **Table Filtering**: Ignore specific tables with wildcard patterns
- **Encryption**: AES-256-GCM encryption for secure backups
- **Compression**: ZIP compression to reduce backup size
- **Retention Policy**: Automatic cleanup of old backups
- **Configurable**: Highly customizable via `ragavan.config`
- **Automatic Scheduling**: Built-in cron-like scheduler for daily backups
- **Multiple Databases**: Backup multiple databases simultaneously

## Installation

```bash
npm install ragavan
```

## Configuration

Create a `ragavan.config` file in your project root:

```json
{
  "databases": [
    {
      "name": "primary_db",
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "your_password",
      "database": "your_database",
      "ssl": false,
      "ignore_tables": ["logs", "temp_*", "cache_*", "sessions"]
    },
    {
      "name": "analytics_db",
      "type": "postgresql",
      "host": "localhost",
      "port": 5432,
      "user": "postgres",
      "password": "your_password",
      "database": "analytics",
      "ssl": false,
      "ignore_tables": ["audit_logs", "temp_data", "debug_logs"]
    },
    {
      "name": "user_data",
      "type": "mongodb",
      "host": "localhost",
      "port": 27017,
      "database": "user_data",
      "ignore_tables": ["system_logs", "temp_collections"]
    }
  ],
  "backup": {
    "destination": "./backups",
    "filename": "backup-{database}-{date}",
    "dateFormat": "YYYY-MM-DD-HH-mm",
    "compression": true,
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm",
      "password": "your_encryption_password"
    },
    "retention": {
      "days": 30,
      "maxBackups": 100
    }
  },
  "schedule": {
    "enabled": true,
    "daily_time": "02:00",
    "timezone": "UTC"
  },
  "logging": {
    "level": "info",
    "file": "./logs/ragavan.log"
  }
}
```

## Usage

### Method 1: Manual Backup
```js
// Import in your Next.js server code
import { backup } from 'ragavan';

// Will backup all databases using settings from ragavan.config
const backupPaths = await backup();
console.log('Backups created:', backupPaths);
```

### Method 2: Automatic Scheduled Backups
```js
// Import in your Next.js server code
import { startScheduler, stopScheduler, getSchedulerStatus } from 'ragavan';

// Start the automatic scheduler
startScheduler();

// The scheduler will now run backups daily at the specified time
// (e.g., 02:00 UTC as configured above)

// Check scheduler status
const status = getSchedulerStatus();
console.log('Scheduler status:', status);

// Stop the scheduler when needed
stopScheduler();
```

### Method 3: Backup specific database
```js
// Import in your Next.js server code
import { backupDatabase } from 'ragavan';

// Backup only the primary database
const backupPath = await backupDatabase('primary_db');
console.log('Backup created:', backupPath);
```

### Method 4: Trigger scheduled backup manually
```js
import { startScheduler, triggerScheduledBackup } from 'ragavan';

// Start scheduler
startScheduler();

// Manually trigger a backup (useful for testing)
await triggerScheduledBackup();
```

### Method 5: Override configuration
```js
// Import in your Next.js server code
import { backup } from 'ragavan';

// Override config with direct parameters
const backupPaths = await backup({
  databases: [
    {
      name: 'custom_db',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'myapp',
      ignore_tables: ['temp_*']
    }
  ],
  backup: {
    destination: './custom-backups',
    compression: false
  }
});
```

### Restore Backup
```js
import { restore } from 'ragavan';

// Restore from backup file
const restoredData = await restore('./backups/backup-primary_db-2024-01-15-14-30.ragavan');
console.log('Restored data:', restoredData);
```

### Get configured databases
```js
import { getConnectedDatabases } from 'ragavan';

// Get list of configured database names
const databases = getConnectedDatabases();
console.log('Configured databases:', databases);
```

## Database Support

### MySQL
```json
{
  "name": "mysql_db",
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "user": "root",
  "password": "password",
  "database": "myapp",
  "ignore_tables": ["logs", "temp_*"]
}
```

### PostgreSQL
```json
{
  "name": "postgres_db",
  "type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "user": "postgres",
  "password": "password",
  "database": "myapp",
  "ignore_tables": ["audit_logs", "temp_*"]
}
```

### MongoDB
```json
{
  "name": "mongo_db",
  "type": "mongodb",
  "host": "localhost",
  "port": 27017,
  "database": "myapp",
  "ignore_tables": ["system_logs", "temp_*"]
}
```

## Configuration Options

### Database Configuration
- `name`: Unique name for the database
- `type`: Database type (`mysql`, `postgresql`, `mongodb`)
- `host`: Database host
- `port`: Database port
- `user`: Database username
- `password`: Database password
- `database`: Database name
- `ssl`: SSL connection (boolean)
- `ignore_tables`: Array of tables to ignore (supports wildcards like `temp_*`)

### Backup Configuration
- `destination`: Backup storage directory
- `filename`: Backup filename pattern (use `{database}` and `{date}` placeholders)
- `dateFormat`: Date format for filename
- `compression`: Enable ZIP compression
- `encryption`: Encryption settings
- `retention`: Backup retention policy

### Encryption Configuration
- `enabled`: Enable encryption
- `algorithm`: Encryption algorithm (`aes-256-gcm`)
- `password`: Encryption password

### Retention Configuration
- `days`: Keep backups for X days
- `maxBackups`: Maximum number of backups to keep

### Schedule Configuration
- `enabled`: Enable daily scheduling
- `daily_time`: Time to run backup daily (format: "HH:MM")
- `timezone`: Timezone for scheduling

## Table Ignoring

You can ignore specific tables using the `ignore_tables` array in each database configuration:

```json
{
  "ignore_tables": [
    "logs",           // Exact table name
    "temp_*",         // All tables starting with "temp_"
    "cache_*",        // All tables starting with "cache_"
    "sessions"        // Exact table name
  ]
}
```

## Automatic Scheduling

The scheduler runs as a cron job at the specified daily time:

```js
// Start automatic backups
startScheduler();

// This will:
// 1. Read your ragavan.config
// 2. Schedule daily backups at the specified time
// 3. Run backups automatically every day
// 4. Handle multiple databases
// 5. Apply ignore_tables rules
// 6. Encrypt and compress backups
// 7. Clean up old backups based on retention policy
```

## API

### Backup Functions
- `backup(options = {})`: Creates backups of today's data from all databases
- `backupDatabase(databaseName, options = {})`: Creates backup for a specific database
- `restore(backupPath, options = {})`: Restores data from backup file
- `getConnectedDatabases(options = {})`: Returns list of configured database names

### Scheduler Functions
- `startScheduler(options = {})`: Starts the automatic backup scheduler
- `stopScheduler()`: Stops the scheduler
- `getSchedulerStatus()`: Returns current scheduler status
- `triggerScheduledBackup()`: Manually triggers a scheduled backup

### Classes
- `BackupManager`: Main backup management class
- `DatabaseManager`: Database connection and query management
- `EncryptionManager`: File encryption/decryption utilities
- `Scheduler`: Automatic scheduling management

## License

ISC 