import Queue from 'bull';
import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { cacheSet } from '../config/redis';

// Initialize queue
const exchangeRateQueue = new Queue('exchange-rate', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Process exchange rate update
exchangeRateQueue.process(async (job) => {
  console.log(`Processing exchange rate update job: ${job.id}`);

  try {
    // In production, this would fetch from an actual exchange rate API
    // For now, we use a fixed rate or slightly adjust the current rate
    const currentRate = await query(
      `SELECT rate FROM exchange_rates ORDER BY effective_date DESC LIMIT 1`
    );

    let newRate: number;

    if (currentRate.rows.length > 0) {
      // Simulate slight rate change (±1%)
      const baseRate = parseFloat(currentRate.rows[0].rate);
      const change = (Math.random() - 0.5) * 0.02 * baseRate; // ±1%
      newRate = Math.round((baseRate + change) * 100) / 100;
    } else {
      // Default rate
      newRate = 1350.00;
    }

    const today = new Date().toISOString().split('T')[0];

    // Insert new exchange rate
    await query(
      `INSERT INTO exchange_rates (id, rate, rate_type, effective_date)
       VALUES ($1, $2, 'weekly', $3)`,
      [generateUUID(), newRate, today]
    );

    // Update Redis cache
    await cacheSet('exchange_rate:current', JSON.stringify({
      rate: newRate,
      effective_date: today,
      updated_at: new Date().toISOString()
    }), 86400); // Cache for 24 hours

    console.log(`Exchange rate updated: ${newRate} KRW/USD`);
    return { rate: newRate, effective_date: today };
  } catch (error) {
    console.error('Exchange rate update job failed:', error);
    throw error;
  }
});

// Handle job events
exchangeRateQueue.on('completed', (job, result) => {
  console.log(`Exchange rate job ${job.id} completed:`, result);
});

exchangeRateQueue.on('failed', (job, err) => {
  console.error(`Exchange rate job ${job.id} failed:`, err);
});

// Schedule weekly update (every Monday at 9:00 AM KST)
export const scheduleExchangeRateJob = async () => {
  // Remove existing repeatable jobs
  const existingJobs = await exchangeRateQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await exchangeRateQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job
  await exchangeRateQueue.add(
    {},
    {
      repeat: {
        cron: '0 0 * * 1', // Every Monday at midnight UTC (9 AM KST)
        tz: 'Asia/Seoul'
      }
    }
  );

  console.log('Exchange rate job scheduled for weekly execution on Mondays at 9:00 AM KST');
};

// Manual trigger
export const triggerExchangeRateUpdate = async () => {
  return exchangeRateQueue.add({});
};

export default exchangeRateQueue;
