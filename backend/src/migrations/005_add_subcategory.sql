-- Add subcategory column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
