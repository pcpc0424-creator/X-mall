import { v4 as uuidv4 } from 'uuid';

export const generateUUID = (): string => {
  return uuidv4();
};

export const generateOrderNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD${year}${month}${day}-${random}`;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
};

export const calculateVatExcluded = (priceWithVat: number): number => {
  return Math.round(priceWithVat / 1.1);
};

export const calculateVat = (priceWithVat: number): number => {
  return Math.round(priceWithVat - calculateVatExcluded(priceWithVat));
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  return phoneRegex.test(phone.replace(/-/g, ''));
};

export const sanitizePhone = (phone: string): string => {
  return phone.replace(/[^0-9]/g, '');
};

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
};

export const maskAccountNumber = (accountNumber: string): string => {
  if (accountNumber.length <= 4) return '****';
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
};
