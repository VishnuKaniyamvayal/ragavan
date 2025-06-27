import crypto from 'crypto';
import fs from 'fs-extra';

class EncryptionManager {
  constructor(config) {
    this.config = config;
    this.algorithm = config.encryption?.algorithm || 'aes-256-gcm';
    this.password = config.encryption?.password;
  }

  generateKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  async encryptFile(inputPath, outputPath) {
    if (!this.config.encryption?.enabled || !this.password) {
      // If encryption is disabled, just copy the file
      await fs.copy(inputPath, outputPath);
      return;
    }

    try {
      const inputData = await fs.readFile(inputPath);
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(16);
      const key = this.generateKey(this.password, salt);

      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('ragavan-backup', 'utf8'));
      
      let encrypted = cipher.update(inputData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine salt, iv, authTag, and encrypted data
      const encryptedData = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
      
      await fs.writeFile(outputPath, encryptedData);
      console.log(`File encrypted successfully: ${outputPath}`);
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decryptFile(inputPath, outputPath) {
    if (!this.config.encryption?.enabled || !this.password) {
      // If encryption is disabled, just copy the file
      await fs.copy(inputPath, outputPath);
      return;
    }

    try {
      const encryptedData = await fs.readFile(inputPath);
      
      // Extract salt, iv, authTag, and encrypted data
      const salt = encryptedData.slice(0, 16);
      const iv = encryptedData.slice(16, 32);
      const authTag = encryptedData.slice(32, 48);
      const encrypted = encryptedData.slice(48);
      
      const key = this.generateKey(this.password, salt);
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('ragavan-backup', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      await fs.writeFile(outputPath, decrypted);
      console.log(`File decrypted successfully: ${outputPath}`);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  async encryptString(data) {
    if (!this.config.encryption?.enabled || !this.password) {
      return data;
    }

    try {
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(16);
      const key = this.generateKey(this.password, salt);

      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('ragavan-backup', 'utf8'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Return base64 encoded string containing salt, iv, authTag, and encrypted data
      const encryptedData = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
      return encryptedData.toString('base64');
    } catch (error) {
      throw new Error(`String encryption failed: ${error.message}`);
    }
  }

  async decryptString(encryptedData) {
    if (!this.config.encryption?.enabled || !this.password) {
      return encryptedData;
    }

    try {
      const data = Buffer.from(encryptedData, 'base64');
      
      // Extract salt, iv, authTag, and encrypted data
      const salt = data.slice(0, 16);
      const iv = data.slice(16, 32);
      const authTag = data.slice(32, 48);
      const encrypted = data.slice(48);
      
      const key = this.generateKey(this.password, salt);
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('ragavan-backup', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`String decryption failed: ${error.message}`);
    }
  }
}

export default EncryptionManager; 