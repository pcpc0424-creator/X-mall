// P-point job removed - P/C/T points no longer supported
import { scheduleXPointReleaseJob, triggerXPointRelease } from './xpoint-release.job';
import { scheduleExchangeRateJob, triggerExchangeRateUpdate } from './exchange-rate.job';

export const initializeJobs = async () => {
  console.log('Initializing background jobs...');

  try {
    // X-point release job (14일 후 자동 지급)
    await scheduleXPointReleaseJob();
    await scheduleExchangeRateJob();

    console.log('All background jobs initialized successfully');
  } catch (error) {
    console.error('Failed to initialize jobs:', error);
  }
};

export {
  triggerXPointRelease,
  triggerExchangeRateUpdate
};
