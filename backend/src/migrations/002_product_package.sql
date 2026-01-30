-- X-mall Product Package Structure Migration
-- Version: 1.0.1

-- 상품 테이블에 product_type 컬럼 추가
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'single'
CHECK (product_type IN ('single', 'package'));

-- 패키지 구성품 테이블 생성
CREATE TABLE IF NOT EXISTS package_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    single_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (package_id, single_product_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_package_items_single_product_id ON package_items(single_product_id);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

-- 패키지는 단품만 포함할 수 있도록 하는 체크 (트리거로 구현)
CREATE OR REPLACE FUNCTION check_package_item_validity()
RETURNS TRIGGER AS $$
DECLARE
    package_type VARCHAR(20);
    single_type VARCHAR(20);
BEGIN
    -- 패키지 상품의 타입 확인
    SELECT product_type INTO package_type FROM products WHERE id = NEW.package_id;
    IF package_type != 'package' THEN
        RAISE EXCEPTION '패키지 상품만 구성품을 가질 수 있습니다.';
    END IF;

    -- 단품 상품의 타입 확인
    SELECT product_type INTO single_type FROM products WHERE id = NEW.single_product_id;
    IF single_type != 'single' THEN
        RAISE EXCEPTION '단품 상품만 패키지에 추가할 수 있습니다.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_package_item_validity_trigger ON package_items;
CREATE TRIGGER check_package_item_validity_trigger
    BEFORE INSERT OR UPDATE ON package_items
    FOR EACH ROW EXECUTE FUNCTION check_package_item_validity();
