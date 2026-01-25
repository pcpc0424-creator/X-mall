import Queue from 'bull';
import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { format } from 'date-fns';

// Initialize queue
const ppointReleaseQueue = new Queue('ppoint-release', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Process pending P-points that are ready to be released
ppointReleaseQueue.process(async (job) => {
  console.log(`Processing P-point release job: ${job.id}`);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Find all pending P-points that should be released today or before
    const pendingResult = await client.query(
      `SELECT * FROM pending_ppoints
       WHERE status = 'pending'
       AND scheduled_release_date <= $1
       FOR UPDATE`,
      [today]
    );

    let releasedCount = 0;
    let totalAmount = 0;

    for (const pending of pendingResult.rows) {
      // Add P-points to user's balance
      const balanceResult = await client.query(
        `UPDATE point_balances
         SET balance = balance + $1
         WHERE user_id = $2 AND point_type = 'P'
         RETURNING balance`,
        [pending.ppoint_amount, pending.user_id]
      );

      const newBalance = parseFloat(balanceResult.rows[0].balance);

      // Record transaction
      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, 'P', $3, 'pv_reward', $4, $5, $6)`,
        [
          generateUUID(),
          pending.user_id,
          pending.ppoint_amount,
          newBalance,
          pending.order_id,
          `PV 리워드 지급 (주문: ${pending.order_id})`
        ]
      );

      // Update pending status
      await client.query(
        `UPDATE pending_ppoints
         SET status = 'released', released_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [pending.id]
      );

      releasedCount++;
      totalAmount += parseFloat(pending.ppoint_amount);
    }

    await client.query('COMMIT');

    console.log(`Released ${releasedCount} P-point records, total: ${totalAmount}`);
    return { releasedCount, totalAmount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('P-point release job failed:', error);
    throw error;
  } finally {
    client.release();
  }
});

// Handle job events
ppointReleaseQueue.on('completed', (job, result) => {
  console.log(`P-point release job ${job.id} completed:`, result);
});

ppointReleaseQueue.on('failed', (job, err) => {
  console.error(`P-point release job ${job.id} failed:`, err);
});

// Schedule daily job at 9:00 AM KST
export const schedulePPointReleaseJob = async () => {
  // Remove existing repeatable jobs
  const existingJobs = await ppointReleaseQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await ppointReleaseQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job (runs every day at 9:00 AM KST = 00:00 UTC)
  await ppointReleaseQueue.add(
    {},
    {
      repeat: {
        cron: '0 0 * * *', // Every day at midnight UTC (9 AM KST)
        tz: 'Asia/Seoul'
      }
    }
  );

  console.log('P-point release job scheduled for daily execution at 9:00 AM KST');
};

// Manual trigger for testing
export const triggerPPointRelease = async () => {
  return ppointReleaseQueue.add({});
};

export default ppointReleaseQueue;
