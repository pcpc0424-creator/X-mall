-- 페이링 결제 요청 테이블
CREATE TABLE IF NOT EXISTS payment_requests (
    id UUID PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    payring_transaction_id VARCHAR(100),
    payment_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_payment_requests_order_id ON payment_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_payring_transaction_id ON payment_requests(payring_transaction_id);
