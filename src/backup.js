import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import DatabaseManager from './database.js';
import EncryptionManager from './encryption.js';
import { StorageManager } from './storage.js';

class BackupManager {
  constructor(config) {
    this.config = config;
    this.dbManager = new DatabaseManager(config);
    this.encryptionManager = new EncryptionManager(config);
    this.storageManager = new StorageManager(config);
  }

  formatDate(date = new Date()) {
    const { dateFormat = 'YYYY-MM-DD-HH-mm' } = this.config.backup;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return dateFormat
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  async createBackupDirectory() {
    const { destination } = this.config.backup;
    const backupDir = path.resolve(destination);
    
    try {
      await fs.ensureDir(backupDir);
      console.log(`Backup directory ensured: ${backupDir}`);
      return backupDir;
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error.message}`);
    }
  }

  async createBackupFile(data, databaseName) {
    const { filename, compression } = this.config.backup;
    const backupDir = await this.createBackupDirectory();
    const formattedDate = this.formatDate();
    const baseFilename = filename
      .replace('{date}', formattedDate)
      .replace('{database}', databaseName);
    
    const backupData = {
      metadata: {
        created_at: new Date().toISOString(),
        database_name: databaseName,
        backup_version: '1.0.0',
        compression: compression,
        encryption: this.config.encryption?.enabled || false
      },
      data: data
    };

    const jsonFilePath = path.join(backupDir, `${baseFilename}.json`);
    const compressedFilePath = path.join(backupDir, `${baseFilename}.zip`);
    const finalFilePath = path.join(backupDir, `${baseFilename}.ragavan`);

    try {
      // Write JSON data
      await fs.writeFile(jsonFilePath, JSON.stringify(backupData, null, 2));
      console.log(`Backup data written to: ${jsonFilePath}`);

      if (compression) {
        // Compress the file
        await this.compressFile(jsonFilePath, compressedFilePath);
        await fs.remove(jsonFilePath); // Remove the uncompressed file
        console.log(`Backup compressed to: ${compressedFilePath}`);
        
        // Encrypt the compressed file
        await this.encryptionManager.encryptFile(compressedFilePath, finalFilePath);
        await fs.remove(compressedFilePath); // Remove the unencrypted compressed file
      } else {
        // Encrypt the JSON file directly
        await this.encryptionManager.encryptFile(jsonFilePath, finalFilePath);
        await fs.remove(jsonFilePath); // Remove the unencrypted file
      }

      console.log(`Backup completed successfully for ${databaseName}: ${finalFilePath}`);
      return finalFilePath;
    } catch (error) {
      // Cleanup on error
      await fs.remove(jsonFilePath).catch(() => {});
      await fs.remove(compressedFilePath).catch(() => {});
      await fs.remove(finalFilePath).catch(() => {});
      throw new Error(`Backup file creation failed for ${databaseName}: ${error.message}`);
    }
  }

  async uploadBackupToStorage(backupFilePath, databaseName) {
    const { filename } = this.config.backup;
    const formattedDate = this.formatDate();
    const baseFilename = filename
      .replace('{date}', formattedDate)
      .replace('{database}', databaseName);
    
    const destinationPath = `${baseFilename}.ragavan`;
    
    try {
      console.log(`Uploading backup to storage providers...`);
      const uploadResults = await this.storageManager.uploadToAll(backupFilePath, destinationPath);
      
      const successfulUploads = Object.entries(uploadResults)
        .filter(([_, result]) => result.success)
        .map(([provider, result]) => ({ provider, path: result.path }));
      
      const failedUploads = Object.entries(uploadResults)
        .filter(([_, result]) => !result.success)
        .map(([provider, result]) => ({ provider, error: result.error }));
      
      if (successfulUploads.length > 0) {
        console.log(`Successfully uploaded to ${successfulUploads.length} storage provider(s):`);
        successfulUploads.forEach(upload => {
          console.log(`  - ${upload.provider}: ${upload.path}`);
        });
      }
      
      if (failedUploads.length > 0) {
        console.warn(`Failed uploads to ${failedUploads.length} storage provider(s):`);
        failedUploads.forEach(upload => {
          console.warn(`  - ${upload.provider}: ${upload.error}`);
        });
      }
      
      return uploadResults;
    } catch (error) {
      console.error(`Upload to storage failed: ${error.message}`);
      throw error;
    }
  }

  async compressFile(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        console.log(`Compression completed: ${archive.pointer()} total bytes`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.file(inputPath, { name: path.basename(inputPath) });
      archive.finalize();
    });
  }

  async cleanupOldBackups() {
    const { retention } = this.config.backup;
    if (!retention) return;

    try {
      // Cleanup from all storage providers
      const providers = this.storageManager.getProviders();
      
      for (const providerName of providers) {
        try {
          const files = await this.storageManager.listFromProvider(providerName);
          const backupFiles = files.filter(file => file.endsWith('.ragavan'));
          
          // Sort by modification time (oldest first)
          const fileStats = await Promise.all(
            backupFiles.map(async (file) => {
              // For now, we'll use file name to determine age
              // In a production system, you might want to store metadata
              const fileName = path.basename(file);
              const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
              const fileDate = dateMatch ? new Date(dateMatch[1]) : new Date(0);
              return { file, fileDate };
            })
          );

          fileStats.sort((a, b) => a.fileDate - b.fileDate);

          // Remove files older than retention days
          if (retention.days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retention.days);

            for (const fileStat of fileStats) {
              if (fileStat.fileDate < cutoffDate) {
                await this.storageManager.deleteFromAll(fileStat.file);
                console.log(`Removed old backup from ${providerName}: ${fileStat.file}`);
              }
            }
          }

          // Remove files exceeding max count
          if (retention.maxBackups && fileStats.length > retention.maxBackups) {
            const filesToRemove = fileStats.slice(0, fileStats.length - retention.maxBackups);
            for (const fileStat of filesToRemove) {
              await this.storageManager.deleteFromAll(fileStat.file);
              console.log(`Removed excess backup from ${providerName}: ${fileStat.file}`);
            }
          }
        } catch (error) {
          console.error(`Cleanup failed for provider ${providerName}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Cleanup process failed:', error.message);
    }
  }

  async performBackup() {
    console.log('Starting backup process...');
    
    try {
      // Connect to all databases
      await this.dbManager.connectAll();
      
      // Get today's data from all databases
      console.log('Extracting today\'s data from all databases...');
      const allData = await this.dbManager.getAllTodayData();
      
      if (Object.keys(allData).length === 0) {
        console.log('No data found for today. Backup completed.');
        return [];
      }

      console.log(`Found data in ${Object.keys(allData).length} databases`);
      
      // Create backup files for each database and upload to storage
      const backupResults = [];
      for (const [databaseName, databaseData] of Object.entries(allData)) {
        if (Object.keys(databaseData).length > 0) {
          const backupPath = await this.createBackupFile(databaseData, databaseName);
          const uploadResults = await this.uploadBackupToStorage(backupPath, databaseName);
          
          backupResults.push({
            database: databaseName,
            localPath: backupPath,
            uploadResults: uploadResults
          });
          
          // Clean up local file after upload
          await fs.remove(backupPath);
          console.log(`Cleaned up local backup file: ${backupPath}`);
        }
      }
      
      // Cleanup old backups from all storage providers
      await this.cleanupOldBackups();
      
      console.log('Backup process completed successfully!');
      return backupResults;
      
    } catch (error) {
      console.error('Backup failed:', error.message);
      throw error;
    } finally {
      // Always disconnect from all databases
      await this.dbManager.disconnect();
    }
  }

  async performBackupForDatabase(databaseName) {
    console.log(`Starting backup process for database: ${databaseName}`);
    
    try {
      // Connect to specific database
      const dbConfig = this.config.databases.find(db => db.name === databaseName);
      if (!dbConfig) {
        throw new Error(`Database ${databaseName} not found in configuration`);
      }
      
      await this.dbManager.connect(dbConfig);
      
      // Get today's data from the specific database
      console.log(`Extracting today's data from database: ${databaseName}`);
      const allData = await this.dbManager.getAllTodayData();
      
      if (!allData[databaseName] || Object.keys(allData[databaseName]).length === 0) {
        console.log(`No data found for today in ${databaseName}. Backup completed.`);
        return null;
      }

      console.log(`Found data in ${Object.keys(allData[databaseName]).length} tables in ${databaseName}`);
      
      // Create backup file for the database and upload to storage
      const backupPath = await this.createBackupFile(allData[databaseName], databaseName);
      const uploadResults = await this.uploadBackupToStorage(backupPath, databaseName);
      
      // Clean up local file after upload
      await fs.remove(backupPath);
      console.log(`Cleaned up local backup file: ${backupPath}`);
      
      console.log(`Backup process completed successfully for ${databaseName}!`);
      return {
        database: databaseName,
        localPath: backupPath,
        uploadResults: uploadResults
      };
      
    } catch (error) {
      console.error(`Backup failed for ${databaseName}:`, error.message);
      throw error;
    } finally {
      // Always disconnect from the database
      await this.dbManager.disconnect(databaseName);
    }
  }

  async restoreBackup(backupPath, outputPath = null) {
    console.log(`Restoring backup from: ${backupPath}`);
    
    try {
      const tempDir = path.join(process.cwd(), '.ragavan-temp');
      await fs.ensureDir(tempDir);
      
      const tempFile = path.join(tempDir, 'temp-backup');
      
      // Decrypt the backup file
      await this.encryptionManager.decryptFile(backupPath, tempFile);
      
      // Check if it's compressed
      let jsonData;
      try {
        // Try to read as JSON first (uncompressed)
        const data = await fs.readFile(tempFile, 'utf8');
        jsonData = JSON.parse(data);
      } catch {
        // If not JSON, it's probably compressed
        const extractPath = path.join(tempDir, 'extracted');
        await fs.ensureDir(extractPath);
        
        // Extract the zip file
        // Note: This is a simplified extraction - in production you'd want a proper zip library
        console.log('Backup appears to be compressed. Manual extraction may be required.');
        jsonData = null;
      }
      
      // Cleanup temp files
      await fs.remove(tempDir);
      
      if (jsonData) {
        if (outputPath) {
          await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2));
          console.log(`Backup restored to: ${outputPath}`);
        }
        return jsonData;
      } else {
        console.log('Backup restored to temporary directory. Please extract manually.');
        return null;
      }
      
    } catch (error) {
      console.error('Restore failed:', error.message);
      throw error;
    }
  }
}

export default BackupManager; 