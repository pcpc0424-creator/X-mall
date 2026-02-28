-- 팝업 테이블에 sort_order 컬럼 추가 (여러 팝업 지원)
ALTER TABLE popup_settings ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 기존 데이터에 sort_order 설정
UPDATE popup_settings SET sort_order = id WHERE sort_order IS NULL OR sort_order = 0;
