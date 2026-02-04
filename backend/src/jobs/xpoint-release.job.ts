import Queue from 'bull';
import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { format } from 'date-fns';

// Initialize queue
const xpointReleaseQueue = new Queue('xpoint-release', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// Process pending X-points that are ready to be released
xpointReleaseQueue.process(async (job) => {
  console.log(`Processing X-point release job: ${job.id}`);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const today = format(new Date(), 'yyyy-MM-dd');

    // Find all pending X-points that should be released today or before
    const pendingResult = await client.query(
      `SELECT * FROM pending_xpoints
       WHERE status = 'pending'
       AND scheduled_release_date <= $1
       FOR UPDATE`,
      [today]
    );

    let releasedCount = 0;
    let totalAmount = 0;

    for (const pending of pendingResult.rows) {
      // Upsert X-point balance (insert if not exists, update if exists)
      const balanceResult = await client.query(
        `INSERT INTO point_balances (user_id, point_type, balance)
         VALUES ($1, 'X', $2)
         ON CONFLICT (user_id, point_type)
         DO UPDATE SET balance = point_balances.balance + $2, updated_at = NOW()
         RETURNING balance`,
        [pending.user_id, pending.xpoint_amount]
      );

      const newBalance = parseFloat(balanceResult.rows[0].balance);

      // Record transaction
      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, 'X', $3, 'pv_reward', $4, $5, $6)`,
        [
          generateUUID(),
          pending.user_id,
          pending.xpoint_amount,
          newBalance,
          pending.order_id,
          `PV 리워드 X포인트 지급 (PV: ${pending.pv_amount}, 주문: ${pending.order_id})`
        ]
      );

      // Update pending status
      await client.query(
        `UPDATE pending_xpoints
         SET status = 'released', released_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [pending.id]
      );

      releasedCount++;
      totalAmount += parseFloat(pending.xpoint_amount);
    }

    await client.query('COMMIT');

    console.log(`Released ${releasedCount} X-point records, total: ${totalAmount} KRW`);
    return { releasedCount, totalAmount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('X-point release job failed:', error);
    throw error;
  } finally {
    client.release();
  }
});

// Handle job events
xpointReleaseQueue.on('completed', (job, result) => {
  console.log(`X-point release job ${job.id} completed:`, result);
});

xpointReleaseQueue.on('failed', (job, err) => {
  console.error(`X-point release job ${job.id} failed:`, err);
});

// Schedule daily job at 9:00 AM KST
export const scheduleXPointReleaseJob = async () => {
  // Remove existing repeatable jobs
  const existingJobs = await xpointReleaseQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await xpointReleaseQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job (runs every day at 9:00 AM KST = 00:00 UTC)
  await xpointReleaseQueue.add(
    {},
    {
      repeat: {
        cron: '0 0 * * *', // Every day at midnight UTC (9 AM KST)
        tz: 'Asia/Seoul'
      }
    }
  );

  console.log('X-point release job scheduled for daily execution at 9:00 AM KST');
};

// Manual trigger for testing
export const triggerXPointRelease = async () => {
  return xpointReleaseQueue.add({});
};

export default xpointReleaseQueue;
