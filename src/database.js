import mysql from 'mysql2/promise';
import pg from 'pg';
import { MongoClient } from 'mongodb';

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.connections = new Map();
  }

  async connect(databaseConfig) {
    const { type, name, ...connectionConfig } = databaseConfig;
    
    try {
      let connection;
      
      switch (type.toLowerCase()) {
        case 'mysql':
          connection = await mysql.createConnection(connectionConfig);
          break;
        case 'postgresql':
        case 'postgres':
          connection = new pg.Client(connectionConfig);
          await connection.connect();
          break;
        case 'mongodb':
          connection = new MongoClient(connectionConfig.url || `mongodb://${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);
          await connection.connect();
          break;
        default:
          throw new Error(`Unsupported database type: ${type}`);
      }
      
      this.connections.set(name, { connection, type, config: databaseConfig });
      console.log(`Connected to ${name} (${type}) database successfully`);
      return connection;
    } catch (error) {
      throw new Error(`Database connection failed for ${name}: ${error.message}`);
    }
  }

  async connectAll() {
    const { databases } = this.config;
    
    if (!databases || !Array.isArray(databases)) {
      throw new Error('No databases configured. Please add databases array to your config.');
    }
    
    for (const dbConfig of databases) {
      try {
        await this.connect(dbConfig);
      } catch (error) {
        console.error(`Failed to connect to database ${dbConfig.name}:`, error.message);
        // Continue with other databases even if one fails
      }
    }
  }

  async disconnect(databaseName = null) {
    if (databaseName) {
      const dbInfo = this.connections.get(databaseName);
      if (dbInfo) {
        try {
          if (dbInfo.connection.end) {
            await dbInfo.connection.end();
          } else if (dbInfo.connection.close) {
            await dbInfo.connection.close();
          }
          this.connections.delete(databaseName);
          console.log(`Database connection closed for ${databaseName}`);
        } catch (error) {
          console.warn(`Error closing database connection for ${databaseName}:`, error.message);
        }
      }
    } else {
      // Disconnect all databases
      for (const [name, dbInfo] of this.connections) {
        try {
          if (dbInfo.connection.end) {
            await dbInfo.connection.end();
          } else if (dbInfo.connection.close) {
            await dbInfo.connection.close();
          }
          console.log(`Database connection closed for ${name}`);
        } catch (error) {
          console.warn(`Error closing database connection for ${name}:`, error.message);
        }
      }
      this.connections.clear();
    }
  }

  async getTables(databaseName) {
    const dbInfo = this.connections.get(databaseName);
    if (!dbInfo) {
      throw new Error(`Database ${databaseName} not connected`);
    }
    
    const { connection, type } = dbInfo;
    
    try {
      switch (type.toLowerCase()) {
        case 'mysql':
          const [rows] = await connection.execute('SHOW TABLES');
          return rows.map(row => Object.values(row)[0]);
        case 'postgresql':
        case 'postgres':
          const result = await connection.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
          `);
          return result.rows.map(row => row.table_name);
        case 'mongodb':
          const db = connection.db();
          return await db.listCollections().toArray().then(collections => 
            collections.map(col => col.name)
          );
        default:
          throw new Error(`Unsupported database type: ${type}`);
      }
    } catch (error) {
      throw new Error(`Failed to get tables from ${databaseName}: ${error.message}`);
    }
  }

  shouldIgnoreTable(tableName, ignoreTables) {
    if (!ignoreTables || ignoreTables.length === 0) {
      return false;
    }
    
    return ignoreTables.some(pattern => {
      if (pattern.includes('*')) {
        // Convert wildcard pattern to regex
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(tableName);
      }
      return tableName === pattern;
    });
  }

  async getTodayData(databaseName, tableName) {
    const dbInfo = this.connections.get(databaseName);
    if (!dbInfo) {
      throw new Error(`Database ${databaseName} not connected`);
    }
    
    const { connection, type, config } = dbInfo;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    // Check if table should be ignored
    if (this.shouldIgnoreTable(tableName, config.ignore_tables)) {
      console.log(`Skipping ignored table: ${tableName} in ${databaseName}`);
      return [];
    }
    
    try {
      switch (type.toLowerCase()) {
        case 'mysql':
          const [rows] = await connection.execute(`
            SELECT * FROM \`${tableName}\` 
            WHERE DATE(created_at) = CURDATE() 
            OR DATE(updated_at) = CURDATE()
          `);
          return rows;
        case 'postgresql':
        case 'postgres':
          const result = await connection.query(`
            SELECT * FROM "${tableName}" 
            WHERE DATE(created_at) = CURRENT_DATE 
            OR DATE(updated_at) = CURRENT_DATE
          `);
          return result.rows;
        case 'mongodb':
          const db = connection.db();
          const collection = db.collection(tableName);
          return await collection.find({
            $or: [
              { created_at: { $gte: startOfDay, $lt: endOfDay } },
              { updated_at: { $gte: startOfDay, $lt: endOfDay } }
            ]
          }).toArray();
        default:
          throw new Error(`Unsupported database type: ${type}`);
      }
    } catch (error) {
      console.warn(`Failed to get today's data from table ${tableName} in ${databaseName}: ${error.message}`);
      return [];
    }
  }

  async getAllTodayData() {
    const allData = {};
    
    for (const [databaseName, dbInfo] of this.connections) {
      try {
        console.log(`Processing database: ${databaseName}`);
        const tables = await this.getTables(databaseName);
        const databaseData = {};
        
        for (const table of tables) {
          const data = await this.getTodayData(databaseName, table);
          if (data.length > 0) {
            databaseData[table] = data;
            console.log(`Found ${data.length} records in ${table} (${databaseName})`);
          }
        }
        
        if (Object.keys(databaseData).length > 0) {
          allData[databaseName] = databaseData;
        }
      } catch (error) {
        console.error(`Error processing database ${databaseName}:`, error.message);
      }
    }
    
    return allData;
  }

  getConnectedDatabases() {
    return Array.from(this.connections.keys());
  }
}

export default DatabaseManager; 