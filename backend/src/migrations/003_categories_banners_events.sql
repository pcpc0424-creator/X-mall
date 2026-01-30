-- Migration: 003_categories_banners_events.sql
-- Description: Add categories, banners, and events management tables

-- =====================
-- CATEGORIES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- =====================
-- BANNERS TABLE (Homepage Sliders)
-- =====================
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(500),
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    button_text VARCHAR(100),
    position VARCHAR(50) DEFAULT 'hero',  -- hero, category, promotion
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);

-- =====================
-- EVENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    content TEXT,
    image_url VARCHAR(500),
    banner_url VARCHAR(500),
    event_type VARCHAR(50) DEFAULT 'promotion',  -- promotion, sale, new_arrival, special
    discount_type VARCHAR(20),  -- percentage, fixed
    discount_value DECIMAL(10, 2),
    coupon_code VARCHAR(50),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);

-- =====================
-- INSERT DEFAULT CATEGORIES
-- =====================
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
    ('cat-health', '건강식품', 'health', '과학적으로 검증된 프리미엄 건강식품', 1),
    ('cat-medical', '의료기기', 'medical', '가정용 의료기기 및 건강측정기', 2),
    ('cat-cosmetic', '화장품', 'cosmetic', '프리미엄 스킨케어 및 뷰티 제품', 3)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for 건강식품
INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES
    ('비타민', 'vitamin', '비타민 & 미네랄 보충제', 'cat-health', 1),
    ('프로바이오틱스', 'probiotics', '장 건강을 위한 유산균', 'cat-health', 2),
    ('홍삼/인삼', 'ginseng', '피로회복 및 면역력 강화', 'cat-health', 3),
    ('오메가3', 'omega', '혈행 및 눈 건강', 'cat-health', 4)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for 의료기기
INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES
    ('혈압계', 'bp', '가정용 혈압 측정기', 'cat-medical', 1),
    ('체온계', 'thermo', '비접촉식 및 접촉식 체온계', 'cat-medical', 2),
    ('혈당계', 'glucose', '당뇨 관리를 위한 혈당 측정기', 'cat-medical', 3),
    ('마사지기', 'massager', '안마기 및 마사지 기기', 'cat-medical', 4)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for 화장품
INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES
    ('스킨케어', 'skincare', '토너, 세럼, 크림 등', 'cat-cosmetic', 1),
    ('메이크업', 'makeup', '베이스, 립, 아이 메이크업', 'cat-cosmetic', 2),
    ('바디케어', 'bodycare', '바디로션 및 바디케어', 'cat-cosmetic', 3),
    ('헤어케어', 'haircare', '샴푸, 트리트먼트 등', 'cat-cosmetic', 4)
ON CONFLICT (slug) DO NOTHING;

-- =====================
-- INSERT DEFAULT BANNERS
-- =====================
INSERT INTO banners (title, subtitle, description, image_url, link_url, button_text, position, sort_order) VALUES
    ('프리미엄 건강식품', '당신의 건강한 라이프스타일을 위한 선택', '과학적으로 검증된 프리미엄 건강기능식품을 만나보세요', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&q=80', '/X-mall/category-health.html', '지금 쇼핑하기', 'hero', 1),
    ('스마트 의료기기', '가정에서 간편하게 건강 체크', '최신 기술이 적용된 가정용 의료기기로 건강을 관리하세요', 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1920&q=80', '/X-mall/category-medical.html', '제품 보러가기', 'hero', 2),
    ('프리미엄 뷰티', '자연에서 찾은 아름다움', '피부 과학으로 완성된 프리미엄 스킨케어 라인', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1920&q=80', '/X-mall/category-cosmetic.html', '컬렉션 보기', 'hero', 3)
ON CONFLICT DO NOTHING;

-- =====================
-- INSERT DEFAULT EVENTS
-- =====================
INSERT INTO events (title, description, image_url, event_type, discount_type, discount_value, start_date, end_date) VALUES
    ('신규 회원 특별 할인', '첫 구매 시 10% 할인 혜택을 드립니다', 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800', 'promotion', 'percentage', 10, NOW(), NOW() + INTERVAL '30 days'),
    ('건강식품 대전', '인기 건강식품 최대 30% 할인', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', 'sale', 'percentage', 30, NOW(), NOW() + INTERVAL '14 days')
ON CONFLICT DO NOTHING;

-- Add category_id to products table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'products' AND column_name = 'category_id') THEN
        ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id);
    END IF;
END $$;
