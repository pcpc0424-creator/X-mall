import * as XLSX from 'xlsx';

export interface MemberExcelRow {
  username: string;
  password: string;
  name: string;
  phone: string;
  grade?: string;
  referrer_username?: string;
}

export interface PointExcelRow {
  username: string;
  point_type: string;
  amount: number;
  reason?: string;
}

export interface RpayExcelRow {
  username: string;
  amount: number;
  reason?: string;
}

export interface ProductExcelRow {
  name: string;
  price_krw: number;
  price_dealer_krw: number;
  pv_value: number;
  stock_quantity?: number;
  category?: string;
  description?: string;
  image_url?: string;
  product_type?: string;
}

export interface ParseResult<T> {
  data: T[];
  errors: { row: number; message: string }[];
}

/**
 * Parse Excel buffer and return array of rows
 */
export function parseExcelBuffer<T>(
  buffer: Buffer,
  requiredFields: string[]
): ParseResult<T> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: '',
    raw: false
  });

  const data: T[] = [];
  const errors: { row: number; message: string }[] = [];

  jsonData.forEach((row, index) => {
    const rowNumber = index + 2; // Excel row number (1-indexed, header is row 1)

    // Normalize keys (trim whitespace, lowercase)
    const normalizedRow: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      normalizedRow[key.trim().toLowerCase()] = row[key];
    }

    // Check required fields
    const missingFields = requiredFields.filter(
      field => !normalizedRow[field] || String(normalizedRow[field]).trim() === ''
    );

    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        message: `필수 필드 누락: ${missingFields.join(', ')}`
      });
      return;
    }

    data.push(normalizedRow as T);
  });

  return { data, errors };
}

/**
 * Validate point type
 */
export function isValidPointType(pointType: string): boolean {
  return ['X'].includes(pointType.toUpperCase());
}

/**
 * Validate user grade
 */
export function isValidGrade(grade: string): boolean {
  return ['dealer', 'consumer'].includes(grade.toLowerCase());
}

/**
 * Validate username format (4-20 chars, alphanumeric only)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9]{4,20}$/;
  return usernameRegex.test(username);
}

/**
 * Parse members excel file
 */
export function parseMembersExcel(buffer: Buffer): ParseResult<MemberExcelRow> {
  const requiredFields = ['username', 'password', 'name', 'phone'];
  const result = parseExcelBuffer<MemberExcelRow>(buffer, requiredFields);

  // Additional validation
  const validatedData: MemberExcelRow[] = [];

  result.data.forEach((row, index) => {
    const rowNumber = index + 2 + result.errors.filter(e => e.row < index + 2).length;

    // Validate username format
    if (!isValidUsername(row.username)) {
      result.errors.push({
        row: rowNumber,
        message: `잘못된 아이디 형식: ${row.username} (4~20자의 영문, 숫자만 가능)`
      });
      return;
    }

    // Normalize grade
    if (row.grade && !isValidGrade(row.grade)) {
      row.grade = 'consumer'; // Default to consumer for invalid grade
    } else if (row.grade) {
      row.grade = row.grade.toLowerCase();
    } else {
      row.grade = 'consumer';
    }

    // Normalize referrer_username (trim whitespace)
    if (row.referrer_username) {
      row.referrer_username = String(row.referrer_username).trim();
      // Validate referrer username format if provided
      if (row.referrer_username && !isValidUsername(row.referrer_username)) {
        result.errors.push({
          row: rowNumber,
          message: `잘못된 추천인 아이디 형식: ${row.referrer_username} (4~20자의 영문, 숫자만 가능)`
        });
        return;
      }
    }

    validatedData.push(row);
  });

  return { data: validatedData, errors: result.errors };
}

/**
 * Parse points excel file
 */
export function parsePointsExcel(buffer: Buffer): ParseResult<PointExcelRow> {
  const requiredFields = ['username', 'point_type', 'amount'];
  const result = parseExcelBuffer<PointExcelRow>(buffer, requiredFields);

  const validatedData: PointExcelRow[] = [];

  result.data.forEach((row, index) => {
    const originalRowNumber = index + 2;

    // Validate username format
    if (!isValidUsername(row.username)) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 아이디 형식: ${row.username}`
      });
      return;
    }

    // Normalize and validate point type
    const normalizedPointType = String(row.point_type).toUpperCase();
    if (!isValidPointType(normalizedPointType)) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 포인트 타입: ${row.point_type} (X만 가능)`
      });
      return;
    }
    row.point_type = normalizedPointType;

    // Validate amount
    const amount = parseFloat(String(row.amount));
    if (isNaN(amount) || amount <= 0) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 금액: ${row.amount} (양수만 가능)`
      });
      return;
    }
    row.amount = amount;

    validatedData.push(row);
  });

  return { data: validatedData, errors: result.errors };
}

/**
 * Validate product type
 */
export function isValidProductType(productType: string): boolean {
  return ['single', 'package'].includes(productType.toLowerCase());
}

/**
 * Parse products excel file
 */
export function parseProductsExcel(buffer: Buffer): ParseResult<ProductExcelRow> {
  const requiredFields = ['name', 'price_krw', 'price_dealer_krw', 'pv_value'];
  const result = parseExcelBuffer<ProductExcelRow>(buffer, requiredFields);

  const validatedData: ProductExcelRow[] = [];

  result.data.forEach((row, index) => {
    const originalRowNumber = index + 2;

    // Validate and convert price_krw
    const priceKrw = parseFloat(String(row.price_krw));
    if (isNaN(priceKrw) || priceKrw < 0) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 소비자가: ${row.price_krw}`
      });
      return;
    }
    row.price_krw = priceKrw;

    // Validate and convert price_dealer_krw
    const priceDealerKrw = parseFloat(String(row.price_dealer_krw));
    if (isNaN(priceDealerKrw) || priceDealerKrw < 0) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 대리점가: ${row.price_dealer_krw}`
      });
      return;
    }
    row.price_dealer_krw = priceDealerKrw;

    // Validate and convert pv_value
    const pvValue = parseFloat(String(row.pv_value));
    if (isNaN(pvValue) || pvValue < 0) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 PV: ${row.pv_value}`
      });
      return;
    }
    row.pv_value = pvValue;

    // Validate and convert stock_quantity (optional)
    if (row.stock_quantity !== undefined && String(row.stock_quantity).trim() !== '') {
      const stockQty = parseInt(String(row.stock_quantity), 10);
      if (isNaN(stockQty) || stockQty < 0) {
        result.errors.push({
          row: originalRowNumber,
          message: `잘못된 재고수량: ${row.stock_quantity}`
        });
        return;
      }
      row.stock_quantity = stockQty;
    } else {
      row.stock_quantity = 0;
    }

    // Normalize product_type (optional, default to 'single')
    if (row.product_type && String(row.product_type).trim() !== '') {
      const normalizedType = String(row.product_type).toLowerCase();
      if (!isValidProductType(normalizedType)) {
        row.product_type = 'single';
      } else {
        row.product_type = normalizedType;
      }
    } else {
      row.product_type = 'single';
    }

    validatedData.push(row);
  });

  return { data: validatedData, errors: result.errors };
}

/**
 * Parse R-pay (X페이) bulk deposit excel file
 */
export function parseRpayExcel(buffer: Buffer): ParseResult<RpayExcelRow> {
  const requiredFields = ['username', 'amount'];
  const result = parseExcelBuffer<RpayExcelRow>(buffer, requiredFields);

  const validatedData: RpayExcelRow[] = [];

  result.data.forEach((row, index) => {
    const originalRowNumber = index + 2;

    // Validate username format
    if (!isValidUsername(row.username)) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 아이디 형식: ${row.username}`
      });
      return;
    }

    // Validate amount
    const amount = parseFloat(String(row.amount));
    if (isNaN(amount) || amount <= 0) {
      result.errors.push({
        row: originalRowNumber,
        message: `잘못된 금액: ${row.amount} (양수만 가능)`
      });
      return;
    }
    row.amount = amount;

    validatedData.push(row);
  });

  return { data: validatedData, errors: result.errors };
}
