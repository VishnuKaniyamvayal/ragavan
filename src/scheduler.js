import cron from 'node-cron';
import BackupManager from './backup.js';

class Scheduler {
  constructor(config) {
    this.config = config;
    this.backupManager = new BackupManager(config);
    this.scheduledJobs = new Map();
  }

  parseDailyTime(dailyTime) {
    if (!dailyTime) {
      throw new Error('Daily time is required for scheduling');
    }

    const timeMatch = dailyTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      throw new Error('Invalid daily time format. Use HH:MM (e.g., "02:00")');
    }

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error('Invalid time values. Hours: 0-23, Minutes: 0-59');
    }

    return { hours, minutes };
  }

  convertToCronExpression(dailyTime) {
    const { hours, minutes } = this.parseDailyTime(dailyTime);
    return `${minutes} ${hours} * * *`;
  }

  async runScheduledBackup() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Starting scheduled backup...`);
    
    try {
      const backupPaths = await this.backupManager.performBackup();
      
      if (backupPaths && backupPaths.length > 0) {
        console.log(`[${timestamp}] Scheduled backup completed successfully. Created ${backupPaths.length} backup(s):`);
        backupPaths.forEach(path => console.log(`  - ${path}`));
      } else {
        console.log(`[${timestamp}] Scheduled backup completed. No new data found for today.`);
      }
    } catch (error) {
      console.error(`[${timestamp}] Scheduled backup failed:`, error.message);
    }
  }

  startScheduler() {
    const { schedule } = this.config;
    
    if (!schedule || !schedule.enabled) {
      console.log('Scheduling is disabled. Set schedule.enabled to true to enable automatic backups.');
      return;
    }

    if (!schedule.daily_time) {
      console.error('Daily time is required for scheduling. Please set schedule.daily_time in your config.');
      return;
    }

    try {
      const cronExpression = this.convertToCronExpression(schedule.daily_time);
      const timezone = schedule.timezone || 'UTC';
      
      console.log(`Starting scheduler with cron expression: ${cronExpression} (${timezone})`);
      console.log(`Backups will run daily at ${schedule.daily_time} ${timezone}`);

      const job = cron.schedule(cronExpression, () => {
        this.runScheduledBackup();
      }, {
        scheduled: true,
        timezone: timezone
      });

      this.scheduledJobs.set('daily_backup', job);
      
      console.log('Scheduler started successfully!');
      
      // Log next run time
      const nextRun = job.nextDate();
      console.log(`Next backup scheduled for: ${nextRun.toISOString()}`);
      
    } catch (error) {
      console.error('Failed to start scheduler:', error.message);
    }
  }

  stopScheduler() {
    console.log('Stopping scheduler...');
    
    for (const [jobName, job] of this.scheduledJobs) {
      job.stop();
      console.log(`Stopped job: ${jobName}`);
    }
    
    this.scheduledJobs.clear();
    console.log('Scheduler stopped successfully!');
  }

  getSchedulerStatus() {
    const status = {
      enabled: this.config.schedule?.enabled || false,
      daily_time: this.config.schedule?.daily_time,
      timezone: this.config.schedule?.timezone || 'UTC',
      active_jobs: this.scheduledJobs.size,
      next_runs: []
    };

    for (const [jobName, job] of this.scheduledJobs) {
      status.next_runs.push({
        job: jobName,
        next_run: job.nextDate().toISOString()
      });
    }

    return status;
  }

  // Manual trigger for testing
  async triggerBackup() {
    console.log('Manually triggering backup...');
    await this.runScheduledBackup();
  }
}

export default Scheduler; 