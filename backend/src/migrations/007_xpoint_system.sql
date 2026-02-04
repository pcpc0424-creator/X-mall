-- X-point System Migration
-- Add X point type to point_balances and point_transactions

-- point_balances에 X 타입 추가
ALTER TABLE point_balances DROP CONSTRAINT IF EXISTS point_balances_point_type_check;
ALTER TABLE point_balances ADD CONSTRAINT point_balances_point_type_check CHECK (point_type IN ('P', 'C', 'T', 'X'));

-- point_transactions에 X 타입 추가
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_point_type_check;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_point_type_check CHECK (point_type IN ('P', 'C', 'T', 'X'));

-- pending_xpoints 테이블 생성 (대리점장 주문 14일 후 X포인트 지급용)
CREATE TABLE IF NOT EXISTS pending_xpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    xpoint_amount DECIMAL(15, 2) NOT NULL,
    pv_amount DECIMAL(15, 2) NOT NULL,
    scheduled_release_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP
);

-- orders 테이블에 X포인트 결제 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_xpoint DECIMAL(15, 2) DEFAULT 0;

-- point_withdrawals에 point_type 추가 (기본값 X - X포인트만 출금 가능)
ALTER TABLE point_withdrawals ADD COLUMN IF NOT EXISTS point_type VARCHAR(10) DEFAULT 'X';

-- point_transactions transaction_type에 admin_deduct 추가
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_transaction_type_check;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_transaction_type_check
  CHECK (transaction_type IN ('grant', 'transfer_in', 'transfer_out', 'payment', 'withdrawal', 'pv_reward', 'refund', 'admin_deduct'));

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_pending_xpoints_user_status ON pending_xpoints(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_xpoints_release_date ON pending_xpoints(scheduled_release_date, status);
