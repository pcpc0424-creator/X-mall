-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_important BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, is_important DESC, created_at DESC);

-- Insert sample announcements
INSERT INTO announcements (title, content, is_important, is_active) VALUES
('X-mall 오픈 이벤트 안내', '안녕하세요, X-mall입니다.\n\n오픈 기념 특별 이벤트를 진행합니다!\n\n- 신규 가입 시 5,000 포인트 지급\n- 첫 구매 시 15% 할인\n- 무료 배송 이벤트\n\n많은 참여 부탁드립니다.', true, true),
('배송 안내 공지', '안녕하세요.\n\n배송 관련 안내드립니다.\n\n- 오후 2시 이전 주문 시 당일 발송\n- 도서산간 지역은 1~2일 추가 소요\n- 배송 조회는 마이페이지에서 가능\n\n감사합니다.', false, true),
('개인정보 처리방침 변경 안내', '개인정보 처리방침이 일부 변경되었습니다.\n\n변경 내용:\n- 개인정보 보관 기간 조정\n- 제3자 제공 항목 명확화\n\n자세한 내용은 개인정보 처리방침 페이지를 참고해주세요.', false, true);
