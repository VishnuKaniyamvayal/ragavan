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
- **Multi-Storage Support**: Upload to multiple destinations (Local, S3, etc.)
- **Extensible Storage**: Plugin architecture for custom storage providers

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
  "storage": {
    "providers": {
      "local": {
        "type": "local",
        "path": "./backups"
      },
      "s3_production": {
        "type": "s3",
        "bucket": "your-backup-bucket",
        "region": "us-east-1",
        "prefix": "database-backups",
        "accessKeyId": "your_access_key_id",
        "secretAccessKey": "your_secret_access_key"
      },
      "s3_archive": {
        "type": "s3",
        "bucket": "your-archive-bucket",
        "region": "us-west-2",
        "prefix": "long-term-backups",
        "accessKeyId": "your_access_key_id",
        "secretAccessKey": "your_secret_access_key"
      }
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

// Will backup all databases and upload to all storage providers
const backupResults = await backup();
console.log('Backup results:', backupResults);
// Output: [{ database: 'primary_db', localPath: '...', uploadResults: {...} }]
```

### Method 2: Automatic Scheduled Backups
```js
// Import in your Next.js server code
import { startScheduler, stopScheduler, getSchedulerStatus } from 'ragavan';

// Start the automatic scheduler
startScheduler();

// The scheduler will now run backups daily at the specified time
// and upload to all configured storage providers

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
const backupResult = await backupDatabase('primary_db');
console.log('Backup result:', backupResult);
```

### Method 4: Storage Management
```js
import { 
  uploadToStorage, 
  uploadToSpecificProvider, 
  getStorageProviders,
  listStorageFiles 
} from 'ragavan';

// Upload a file to all storage providers
const uploadResults = await uploadToStorage('./my-file.txt', 'uploads/my-file.txt');

// Upload to specific provider
await uploadToSpecificProvider('s3_production', './my-file.txt', 'uploads/my-file.txt');

// Get list of storage providers
const providers = getStorageProviders();
console.log('Available providers:', providers);

// List files in S3 bucket
const files = await listStorageFiles('s3_production', 'database-backups/');
console.log('S3 files:', files);
```

### Method 5: Trigger scheduled backup manually
```js
import { startScheduler, triggerScheduledBackup } from 'ragavan';

// Start scheduler
startScheduler();

// Manually trigger a backup (useful for testing)
await triggerScheduledBackup();
```

### Method 6: Override configuration
```js
// Import in your Next.js server code
import { backup } from 'ragavan';

// Override config with direct parameters
const backupResults = await backup({
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
  storage: {
    providers: {
      s3_custom: {
        type: 's3',
        bucket: 'my-custom-bucket',
        region: 'us-east-1',
        accessKeyId: 'key',
        secretAccessKey: 'secret'
      }
    }
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

## Storage Providers

### Local Storage
```json
{
  "local": {
    "type": "local",
    "path": "./backups"
  }
}
```

### AWS S3
```json
{
  "s3_production": {
    "type": "s3",
    "bucket": "your-backup-bucket",
    "region": "us-east-1",
    "prefix": "database-backups",
    "accessKeyId": "your_access_key_id",
    "secretAccessKey": "your_secret_access_key"
  }
}
```

### Multiple Storage Providers
You can configure multiple storage providers for redundancy:

```json
{
  "storage": {
    "providers": {
      "local": { "type": "local", "path": "./backups" },
      "s3_primary": { "type": "s3", "bucket": "primary-backup-bucket", ... },
      "s3_secondary": { "type": "s3", "bucket": "secondary-backup-bucket", ... }
    }
  }
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
- `destination`: Local backup storage directory
- `filename`: Backup filename pattern (use `{database}` and `{date}` placeholders)
- `dateFormat`: Date format for filename
- `compression`: Enable ZIP compression
- `encryption`: Encryption settings
- `retention`: Backup retention policy

### Storage Configuration
- `providers`: Object containing storage provider configurations
- Each provider can be `local` or `s3` type
- S3 providers require bucket, region, and credentials

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
// 7. Upload to all configured storage providers
// 8. Clean up old backups based on retention policy
```

## Extending Storage Providers

You can create custom storage providers by extending the `StorageProvider` class:

```js
import { StorageProvider, getStorageManager } from 'ragavan';

class CustomStorageProvider extends StorageProvider {
  async upload(filePath, destinationPath) {
    // Implement your upload logic
    console.log(`Uploading ${filePath} to custom storage as ${destinationPath}`);
  }

  async delete(filePath) {
    // Implement your delete logic
    console.log(`Deleting ${filePath} from custom storage`);
  }

  async list(prefix = '') {
    // Implement your list logic
    return [];
  }

  async exists(filePath) {
    // Implement your exists logic
    return false;
  }
}

// Add custom provider
const storageManager = getStorageManager();
storageManager.addProvider('custom', new CustomStorageProvider({}));
```

## API

### Backup Functions
- `backup(options = {})`: Creates backups of today's data from all databases
- `backupDatabase(databaseName, options = {})`: Creates backup for a specific database
- `restore(backupPath, outputPath = null)`: Restores data from backup file
- `getConnectedDatabases(options = {})`: Returns list of configured database names

### Storage Functions
- `uploadToStorage(filePath, destinationPath, options = {})`: Upload to all storage providers
- `uploadToSpecificProvider(providerName, filePath, destinationPath, options = {})`: Upload to specific provider
- `getStorageProviders(options = {})`: Returns list of available storage providers
- `listStorageFiles(providerName, prefix = '', options = {})`: List files in storage provider
- `deleteFromStorage(filePath, options = {})`: Delete file from all storage providers

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
- `StorageManager`: Multi-storage provider management
- `StorageProvider`: Base class for storage providers
- `LocalStorageProvider`: Local file system storage
- `S3StorageProvider`: AWS S3 storage

## License

ISC 