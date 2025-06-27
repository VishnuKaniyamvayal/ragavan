import fs from 'fs-extra';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Base Storage Provider Class
class StorageProvider {
  constructor(config) {
    this.config = config;
  }

  async upload(filePath, destinationPath) {
    throw new Error('upload method must be implemented by subclass');
  }

  async delete(filePath) {
    throw new Error('delete method must be implemented by subclass');
  }

  async list(prefix = '') {
    throw new Error('list method must be implemented by subclass');
  }

  async exists(filePath) {
    throw new Error('exists method must be implemented by subclass');
  }
}

// Local File System Storage Provider
class LocalStorageProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.basePath = config.path || './backups';
  }

  async upload(filePath, destinationPath) {
    const fullDestinationPath = path.join(this.basePath, destinationPath);
    await fs.ensureDir(path.dirname(fullDestinationPath));
    await fs.copy(filePath, fullDestinationPath);
    console.log(`File uploaded to local storage: ${fullDestinationPath}`);
    return fullDestinationPath;
  }

  async delete(filePath) {
    const fullPath = path.join(this.basePath, filePath);
    if (await fs.pathExists(fullPath)) {
      await fs.remove(fullPath);
      console.log(`File deleted from local storage: ${fullPath}`);
      return true;
    }
    return false;
  }

  async list(prefix = '') {
    const fullPrefixPath = path.join(this.basePath, prefix);
    if (!await fs.pathExists(fullPrefixPath)) {
      return [];
    }
    
    const files = await fs.readdir(fullPrefixPath, { recursive: true });
    return files.filter(file => typeof file === 'string').map(file => path.join(prefix, file));
  }

  async exists(filePath) {
    const fullPath = path.join(this.basePath, filePath);
    return await fs.pathExists(fullPath);
  }
}

// AWS S3 Storage Provider
class S3StorageProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.bucket = config.bucket;
    this.region = config.region || 'us-east-1';
    this.prefix = config.prefix || '';
    
    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async upload(filePath, destinationPath) {
    const key = path.join(this.prefix, destinationPath).replace(/\\/g, '/');
    
    try {
      const fileContent = await fs.readFile(filePath);
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileContent,
        ContentType: 'application/octet-stream'
      });

      await this.client.send(command);
      console.log(`File uploaded to S3: s3://${this.bucket}/${key}`);
      return `s3://${this.bucket}/${key}`;
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  async delete(filePath) {
    const key = path.join(this.prefix, filePath).replace(/\\/g, '/');
    
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.client.send(command);
      console.log(`File deleted from S3: s3://${this.bucket}/${key}`);
      return true;
    } catch (error) {
      console.error(`S3 delete failed: ${error.message}`);
      return false;
    }
  }

  async list(prefix = '') {
    const fullPrefix = path.join(this.prefix, prefix).replace(/\\/g, '/');
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: fullPrefix
      });

      const response = await this.client.send(command);
      return response.Contents?.map(obj => obj.Key.replace(this.prefix + '/', '')) || [];
    } catch (error) {
      console.error(`S3 list failed: ${error.message}`);
      return [];
    }
  }

  async exists(filePath) {
    const key = path.join(this.prefix, filePath).replace(/\\/g, '/');
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: key,
        MaxKeys: 1
      });

      const response = await this.client.send(command);
      return response.Contents && response.Contents.length > 0;
    } catch (error) {
      return false;
    }
  }
}

// Storage Manager - Handles multiple storage providers
class StorageManager {
  constructor(config) {
    this.config = config;
    this.providers = new Map();
    this.initializeProviders();
  }

  initializeProviders() {
    const { storage } = this.config;
    
    if (!storage || !storage.providers) {
      // Default to local storage if no storage config
      this.providers.set('local', new LocalStorageProvider({ path: './backups' }));
      return;
    }

    for (const [name, providerConfig] of Object.entries(storage.providers)) {
      try {
        let provider;
        
        switch (providerConfig.type.toLowerCase()) {
          case 'local':
            provider = new LocalStorageProvider(providerConfig);
            break;
          case 's3':
            provider = new S3StorageProvider(providerConfig);
            break;
          default:
            console.warn(`Unknown storage provider type: ${providerConfig.type}`);
            continue;
        }
        
        this.providers.set(name, provider);
        console.log(`Storage provider initialized: ${name} (${providerConfig.type})`);
      } catch (error) {
        console.error(`Failed to initialize storage provider ${name}:`, error.message);
      }
    }
  }

  async uploadToAll(filePath, destinationPath) {
    const results = {};
    
    for (const [name, provider] of this.providers) {
      try {
        const result = await provider.upload(filePath, destinationPath);
        results[name] = { success: true, path: result };
        console.log(`Upload successful to ${name}: ${result}`);
      } catch (error) {
        results[name] = { success: false, error: error.message };
        console.error(`Upload failed to ${name}:`, error.message);
      }
    }
    
    return results;
  }

  async uploadToProvider(providerName, filePath, destinationPath) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Storage provider '${providerName}' not found`);
    }
    
    return await provider.upload(filePath, destinationPath);
  }

  async deleteFromAll(filePath) {
    const results = {};
    
    for (const [name, provider] of this.providers) {
      try {
        const result = await provider.delete(filePath);
        results[name] = { success: true, deleted: result };
      } catch (error) {
        results[name] = { success: false, error: error.message };
      }
    }
    
    return results;
  }

  async listFromProvider(providerName, prefix = '') {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Storage provider '${providerName}' not found`);
    }
    
    return await provider.list(prefix);
  }

  getProviders() {
    return Array.from(this.providers.keys());
  }

  // Method to add custom storage providers
  addProvider(name, provider) {
    if (!(provider instanceof StorageProvider)) {
      throw new Error('Provider must extend StorageProvider class');
    }
    
    this.providers.set(name, provider);
    console.log(`Custom storage provider added: ${name}`);
  }
}

export { StorageManager, StorageProvider, LocalStorageProvider, S3StorageProvider }; 