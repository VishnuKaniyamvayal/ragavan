import fs from 'fs';
import path from 'path';
import BackupManager from './src/backup.js';
import Scheduler from './src/scheduler.js';
import { StorageManager } from './src/storage.js';

// Global scheduler instance
let globalScheduler = null;
let globalStorageManager = null;

function loadConfig() {
  const configPath = path.join(process.cwd(), 'ragavan.config');
  
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configContent);
    }
  } catch (error) {
    console.warn('Warning: Could not read ragavan.config file:', error.message);
  }
  
  return null;
}

export async function backup(options = {}) {
  // Load config from ragavan.config file
  const config = loadConfig();
  
  if (!config && Object.keys(options).length === 0) {
    throw new Error('No configuration found. Please create a ragavan.config file or provide configuration options.');
  }
  
  // Merge config with options (options take precedence)
  const finalConfig = {
    ...config,
    ...options
  };
  
  // Validate required configuration
  if (!finalConfig.databases || !Array.isArray(finalConfig.databases)) {
    throw new Error('Databases configuration is required in ragavan.config or options.');
  }
  
  if (!finalConfig.backup) {
    throw new Error('Backup configuration is required in ragavan.config or options.');
  }
  
  // Create backup manager and perform backup
  const backupManager = new BackupManager(finalConfig);
  return await backupManager.performBackup();
}

export async function backupDatabase(databaseName, options = {}) {
  // Load config from ragavan.config file
  const config = loadConfig();
  
  if (!config && Object.keys(options).length === 0) {
    throw new Error('No configuration found. Please create a ragavan.config file or provide configuration options.');
  }
  
  // Merge config with options (options take precedence)
  const finalConfig = {
    ...config,
    ...options
  };
  
  // Validate required configuration
  if (!finalConfig.databases || !Array.isArray(finalConfig.databases)) {
    throw new Error('Databases configuration is required in ragavan.config or options.');
  }
  
  if (!finalConfig.backup) {
    throw new Error('Backup configuration is required in ragavan.config or options.');
  }
  
  // Validate database name
  if (!databaseName) {
    throw new Error('Database name is required.');
  }
  
  // Create backup manager and perform backup for specific database
  const backupManager = new BackupManager(finalConfig);
  return await backupManager.performBackupForDatabase(databaseName);
}

export async function restore(backupPath, outputPath = null) {
  const config = loadConfig();
  
  if (!config && Object.keys(options).length === 0) {
    throw new Error('No configuration found. Please create a ragavan.config file or provide configuration options.');
  }
  
  const finalConfig = {
    ...config,
    ...options
  };
  
  const backupManager = new BackupManager(finalConfig);
  return await backupManager.restoreBackup(backupPath);
}

export function getConnectedDatabases(options = {}) {
  const config = loadConfig();
  
  if (!config && Object.keys(options).length === 0) {
    throw new Error('No configuration found. Please create a ragavan.config file or provide configuration options.');
  }
  
  const finalConfig = {
    ...config,
    ...options
  };
  
  if (!finalConfig.databases || !Array.isArray(finalConfig.databases)) {
    return [];
  }
  
  return finalConfig.databases.map(db => db.name);
}

// Storage functions
export function getStorageManager(options = {}) {
  const config = loadConfig();
  
  if (!config && Object.keys(options).length === 0) {
    throw new Error('No configuration found. Please create a ragavan.config file or provide configuration options.');
  }
  
  const finalConfig = {
    ...config,
    ...options
  };
  
  if (!globalStorageManager) {
    globalStorageManager = new StorageManager(finalConfig);
  }
  
  return globalStorageManager;
}

export async function uploadToStorage(filePath, destinationPath, options = {}) {
  const storageManager = getStorageManager(options);
  return await storageManager.uploadToAll(filePath, destinationPath);
}

export async function uploadToSpecificProvider(providerName, filePath, destinationPath, options = {}) {
  const storageManager = getStorageManager(options);
  return await storageManager.uploadToProvider(providerName, filePath, destinationPath);
}

export function getStorageProviders(options = {}) {
  const storageManager = getStorageManager(options);
  return storageManager.getProviders();
}

export async function listStorageFiles(providerName, prefix = '', options = {}) {
  const storageManager = getStorageManager(options);
  return await storageManager.listFromProvider(providerName, prefix);
}

export async function deleteFromStorage(filePath, options = {}) {
  const storageManager = getStorageManager(options);
  return await storageManager.deleteFromAll(filePath);
}

// Scheduler functions
export function startScheduler(options = {}) {
  const config = loadConfig();
  
  if (!config && Object.keys(options).length === 0) {
    throw new Error('No configuration found. Please create a ragavan.config file or provide configuration options.');
  }
  
  const finalConfig = {
    ...config,
    ...options
  };
  
  // Stop existing scheduler if running
  if (globalScheduler) {
    globalScheduler.stopScheduler();
  }
  
  // Create and start new scheduler
  globalScheduler = new Scheduler(finalConfig);
  globalScheduler.startScheduler();
  
  return globalScheduler;
}

export function stopScheduler() {
  if (globalScheduler) {
    globalScheduler.stopScheduler();
    globalScheduler = null;
    console.log('Global scheduler stopped');
  } else {
    console.log('No scheduler is currently running');
  }
}

export function getSchedulerStatus() {
  if (globalScheduler) {
    return globalScheduler.getSchedulerStatus();
  } else {
    return {
      enabled: false,
      active_jobs: 0,
      message: 'No scheduler is currently running'
    };
  }
}

export async function triggerScheduledBackup() {
  if (globalScheduler) {
    await globalScheduler.triggerBackup();
  } else {
    throw new Error('No scheduler is currently running. Start scheduler first.');
  }
}

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Stopping scheduler...');
  stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Stopping scheduler...');
  stopScheduler();
  process.exit(0);
});

export { BackupManager } from './src/backup.js';
export { default as DatabaseManager } from './src/database.js';
export { default as EncryptionManager } from './src/encryption.js';
export { default as Scheduler } from './src/scheduler.js';
export { StorageManager, StorageProvider, LocalStorageProvider, S3StorageProvider } from './src/storage.js'; 