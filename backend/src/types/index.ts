import { Request } from 'express';

export type UserGrade = 'dealer' | 'consumer';
export type PointType = 'X';
export type ProductType = 'single' | 'package';
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type PendingPointStatus = 'pending' | 'released' | 'cancelled';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  phone: string;
  grade: UserGrade;
  is_active: boolean;
  referrer_id?: string;
  created_at: Date;
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: string;
}

export interface Product {
  id: string;
  name: string;
  price_krw: number;
  price_dealer_krw: number;
  pv_value: number;
  stock_quantity: number;
  description?: string;
  image_url?: string;
  category?: string;
  product_type: ProductType;
  is_active: boolean;
}

export interface PackageItem {
  id: string;
  package_id: string;
  single_product_id: string;
  quantity: number;
  created_at: Date;
  // Joined fields
  single_product_name?: string;
  single_product_price?: number;
  single_product_pv?: number;
}

export interface RpayBalance {
  user_id: string;
  balance_krw: number;
}

export interface PointBalance {
  user_id: string;
  point_type: PointType;
  balance: number;
}

export interface PendingXPoint {
  id: string;
  user_id: string;
  order_id: string;
  xpoint_amount: number;
  pv_amount: number;
  scheduled_release_date: Date;
  status: PendingPointStatus;
  created_at: Date;
  released_at?: Date;
}

export interface PointWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: WithdrawalStatus;
  request_date: Date;
  scheduled_payment_date: Date;
  processed_at?: Date;
  admin_note?: string;
}

export interface PointTransfer {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_point_type: PointType;
  amount: number;
  created_at: Date;
}

export interface ExchangeRate {
  id: string;
  rate: number;
  rate_type: 'weekly' | 'monthly';
  effective_date: Date;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  total_pv: number;
  total_krw: number;
  payment_rpay: number;
  payment_xpoint: number;
  payment_ppoint: number;
  payment_cpoint: number;
  payment_tpoint: number;
  payment_card: number;
  payment_bank: number;
  status: OrderStatus;
  invoice_number?: string;
  shipping_address: string;
  shipping_name: string;
  shipping_phone: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_pv: number;
  total_price: number;
  total_pv: number;
}

export interface Holiday {
  holiday_date: Date;
  description: string;
}

// Extended Request types
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    grade: UserGrade;
  };
}

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
    role: string;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Request body types
export interface SignupBody {
  username: string;
  password: string;
  name: string;
  phone: string;
  referrer_username?: string;
}

export interface LoginBody {
  username: string;
  password: string;
}

export interface AdminLoginBody {
  username: string;
  password: string;
}

// PointTransferBody removed - P/C/T point transfer no longer supported

export interface WithdrawalRequestBody {
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

export interface CreateOrderBody {
  items: {
    product_id: string;
    quantity: number;
  }[];
  payment: {
    rpay?: number;
    xpoint?: number;
    card?: number;
    bank?: number;
    payring_order_id?: string;
    payring_transaction_id?: string;
  };
  shipping: {
    address: string;
    name: string;
    phone: string;
  };
}

export interface AdminGrantPointsBody {
  user_id: string;
  point_type: PointType;
  amount: number;
  reason?: string;
}

export interface AdminRpayDepositBody {
  user_id: string;
  amount: number;
  reason?: string;
}
