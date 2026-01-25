import bcrypt from 'bcryptjs';
import { pool, query } from '../config/database';
import { generateUUID } from '../utils/helpers';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  console.log('Starting database seeding...');

  try {
    // Create default admin user
    const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@xmall.com';
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123!@#';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

    const existingAdmin = await query('SELECT id FROM admin_users WHERE email = $1', [adminEmail]);

    if (existingAdmin.rows.length === 0) {
      await query(
        `INSERT INTO admin_users (id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [generateUUID(), adminEmail, adminPasswordHash, '시스템관리자', 'superadmin']
      );
      console.log(`Created admin user: ${adminEmail}`);
    } else {
      console.log('Admin user already exists');
    }

    // Seed sample products
    const products = [
      { name: '클로렐라', price_krw: 55000, price_dealer_krw: 50000, pv_value: 50, category: 'health', image_url: '/images/chlorella.jpg' },
      { name: '프로바이오틱스', price_krw: 44000, price_dealer_krw: 40000, pv_value: 40, category: 'health', image_url: '/images/probiotics.jpg' },
      { name: '오메가3', price_krw: 66000, price_dealer_krw: 60000, pv_value: 60, category: 'health', image_url: '/images/omega.jpg' },
      { name: '비타민C', price_krw: 33000, price_dealer_krw: 30000, pv_value: 30, category: 'health', image_url: '/images/vitamin.jpg' },
      { name: '선크림 SPF50+', price_krw: 38500, price_dealer_krw: 35000, pv_value: 35, category: 'cosmetic', image_url: '/images/sunscreen.jpg' },
      { name: '히알루론산 세럼', price_krw: 55000, price_dealer_krw: 50000, pv_value: 50, category: 'cosmetic', image_url: '/images/hyaluronic.jpg' },
      { name: '녹차 클렌저', price_krw: 27500, price_dealer_krw: 25000, pv_value: 25, category: 'cosmetic', image_url: '/images/greentea.jpg' },
      { name: '바디로션', price_krw: 33000, price_dealer_krw: 30000, pv_value: 30, category: 'cosmetic', image_url: '/images/bodylotion.jpg' },
      { name: '체온계 (브라운)', price_krw: 88000, price_dealer_krw: 80000, pv_value: 80, category: 'medical', image_url: '/images/thermo.jpg' },
      { name: '혈압계 (오므론)', price_krw: 110000, price_dealer_krw: 100000, pv_value: 100, category: 'medical', image_url: '/images/bp.jpg' },
      { name: '혈당측정기', price_krw: 55000, price_dealer_krw: 50000, pv_value: 50, category: 'medical', image_url: '/images/glucose.jpg' },
      { name: '목 마사지기', price_krw: 165000, price_dealer_krw: 150000, pv_value: 150, category: 'medical', image_url: '/images/massager.jpg' },
    ];

    for (const product of products) {
      const existing = await query('SELECT id FROM products WHERE name = $1', [product.name]);
      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO products (id, name, price_krw, price_dealer_krw, pv_value, category, image_url, stock_quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [generateUUID(), product.name, product.price_krw, product.price_dealer_krw, product.pv_value, product.category, product.image_url, 100]
        );
        console.log(`Created product: ${product.name}`);
      }
    }

    // Seed 2025-2026 Korean holidays
    const holidays = [
      { date: '2025-01-01', description: '신정' },
      { date: '2025-01-28', description: '설날 전날' },
      { date: '2025-01-29', description: '설날' },
      { date: '2025-01-30', description: '설날 다음날' },
      { date: '2025-03-01', description: '삼일절' },
      { date: '2025-05-05', description: '어린이날' },
      { date: '2025-05-06', description: '부처님오신날' },
      { date: '2025-06-06', description: '현충일' },
      { date: '2025-08-15', description: '광복절' },
      { date: '2025-10-03', description: '개천절' },
      { date: '2025-10-05', description: '추석 전날' },
      { date: '2025-10-06', description: '추석' },
      { date: '2025-10-07', description: '추석 다음날' },
      { date: '2025-10-09', description: '한글날' },
      { date: '2025-12-25', description: '크리스마스' },
      { date: '2026-01-01', description: '신정' },
      { date: '2026-02-16', description: '설날 전날' },
      { date: '2026-02-17', description: '설날' },
      { date: '2026-02-18', description: '설날 다음날' },
      { date: '2026-03-01', description: '삼일절' },
      { date: '2026-05-05', description: '어린이날' },
      { date: '2026-05-24', description: '부처님오신날' },
      { date: '2026-06-06', description: '현충일' },
      { date: '2026-08-15', description: '광복절' },
      { date: '2026-09-24', description: '추석 전날' },
      { date: '2026-09-25', description: '추석' },
      { date: '2026-09-26', description: '추석 다음날' },
      { date: '2026-10-03', description: '개천절' },
      { date: '2026-10-09', description: '한글날' },
      { date: '2026-12-25', description: '크리스마스' },
    ];

    for (const holiday of holidays) {
      const existing = await query('SELECT id FROM holidays WHERE holiday_date = $1', [holiday.date]);
      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO holidays (id, holiday_date, description) VALUES ($1, $2, $3)`,
          [generateUUID(), holiday.date, holiday.description]
        );
      }
    }
    console.log('Seeded Korean holidays for 2025-2026');

    // Set initial exchange rate (1 point = 1 USD)
    const existingRate = await query('SELECT id FROM exchange_rates ORDER BY effective_date DESC LIMIT 1');
    if (existingRate.rows.length === 0) {
      await query(
        `INSERT INTO exchange_rates (id, rate, rate_type, effective_date)
         VALUES ($1, $2, $3, $4)`,
        [generateUUID(), 1350.00, 'weekly', new Date().toISOString().split('T')[0]]
      );
      console.log('Set initial exchange rate: 1 USD = 1350 KRW');
    }

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

seedDatabase();
