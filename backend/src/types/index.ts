import { Request } from 'express';

export type UserGrade = 'dealer' | 'consumer';
export type PointType = 'P' | 'C' | 'T';
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type PendingPointStatus = 'pending' | 'released' | 'cancelled';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string;
  grade: UserGrade;
  is_active: boolean;
  created_at: Date;
}

export interface AdminUser {
  id: string;
  email: string;
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
  is_active: boolean;
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

export interface PendingPPoint {
  id: string;
  user_id: string;
  order_id: string;
  ppoint_amount: number;
  scheduled_release_date: Date;
  status: PendingPointStatus;
  created_at: Date;
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
    email: string;
    grade: UserGrade;
  };
}

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    email: string;
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
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface PointTransferBody {
  to_user_email: string;
  point_type: 'P' | 'C';
  amount: number;
}

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
    ppoint?: number;
    cpoint?: number;
    tpoint?: number;
    card?: number;
    bank?: number;
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
