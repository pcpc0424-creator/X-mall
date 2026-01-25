import { schedulePPointReleaseJob, triggerPPointRelease } from './ppoint-release.job';
import { scheduleExchangeRateJob, triggerExchangeRateUpdate } from './exchange-rate.job';

export const initializeJobs = async () => {
  console.log('Initializing background jobs...');

  try {
    await schedulePPointReleaseJob();
    await scheduleExchangeRateJob();

    console.log('All background jobs initialized successfully');
  } catch (error) {
    console.error('Failed to initialize jobs:', error);
  }
};

export {
  triggerPPointRelease,
  triggerExchangeRateUpdate
};
