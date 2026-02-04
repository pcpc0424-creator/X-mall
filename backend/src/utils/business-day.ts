import { addDays, isWeekend, format } from 'date-fns';
import { query } from '../config/database';

// Cache holidays in memory
let holidaysCache: Set<string> = new Set();
let holidaysCacheExpiry: Date | null = null;

export const loadHolidays = async (): Promise<Set<string>> => {
  // Check cache validity (refresh every hour)
  if (holidaysCacheExpiry && holidaysCacheExpiry > new Date()) {
    return holidaysCache;
  }

  const result = await query(
    'SELECT holiday_date FROM holidays WHERE holiday_date >= CURRENT_DATE - INTERVAL \'30 days\''
  );

  holidaysCache = new Set(
    result.rows.map((row: { holiday_date: Date }) => format(row.holiday_date, 'yyyy-MM-dd'))
  );
  holidaysCacheExpiry = addDays(new Date(), 1);

  return holidaysCache;
};

export const isHoliday = async (date: Date): Promise<boolean> => {
  const holidays = await loadHolidays();
  return holidays.has(format(date, 'yyyy-MM-dd'));
};

export const isBusinessDay = async (date: Date): Promise<boolean> => {
  if (isWeekend(date)) return false;
  return !(await isHoliday(date));
};

export const getNextBusinessDay = async (fromDate: Date): Promise<Date> => {
  let nextDay = addDays(fromDate, 1);

  while (isWeekend(nextDay) || (await isHoliday(nextDay))) {
    nextDay = addDays(nextDay, 1);
  }

  return nextDay;
};

export const addBusinessDays = async (fromDate: Date, days: number): Promise<Date> => {
  let result = fromDate;
  let addedDays = 0;

  while (addedDays < days) {
    result = addDays(result, 1);
    if (await isBusinessDay(result)) {
      addedDays++;
    }
  }

  return result;
};

// Add 14 calendar days for X-point release
export const getXPointReleaseDate = (orderDate: Date): Date => {
  return addDays(orderDate, 14);
};
