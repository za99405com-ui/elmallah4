-- ==============================================================================
-- El-Mallah Seafood (متجر الملاح لبيع الأسماك الطازجة)
-- Unified Database Schema for Customer Store & Admin Panel
-- ==============================================================================

-- 1. Customers Table (العملاء المسجلون بأرقام الموبايل المصرية)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    governorate VARCHAR(50) NOT NULL,
    city VARCHAR(50),
    district VARCHAR(50),
    address TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 2. Products Table (الأسماك والأصناف الأساسية)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    original_price DECIMAL(10, 2),
    unit VARCHAR(20) DEFAULT 'كيلو' NOT NULL,
    in_stock BOOLEAN DEFAULT true NOT NULL,
    is_visible BOOLEAN DEFAULT true NOT NULL,
    sort_order INT DEFAULT 0,
    image TEXT NOT NULL,
    description TEXT,
    sale_type VARCHAR(20) DEFAULT 'weight' NOT NULL,
    pieces_per_kilo_range VARCHAR(50),
    piece_weight_range VARCHAR(50),
    min_order DECIMAL(10, 2) DEFAULT 1,
    max_order DECIMAL(10, 2),
    deposit_type VARCHAR(20) DEFAULT 'percentage',
    deposit_value DECIMAL(10, 2) DEFAULT 20,
    is_popular BOOLEAN DEFAULT false,
    is_today_offer BOOLEAN DEFAULT false,
    is_new_arrival BOOLEAN DEFAULT false,
    sales_count INT DEFAULT 0,
    badge_text VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_visibility ON products(is_visible, sort_order);

-- 3. Product Variants Table (خيارات البيع والأحجام وعدد القطع)
CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    weight_kg DECIMAL(6, 3) DEFAULT 1.000 NOT NULL,
    piece_count INT NOT NULL,
    piece_weight_min INT,
    piece_weight_max INT,
    price DECIMAL(10, 2) NOT NULL,
    original_price DECIMAL(10, 2),
    stock_quantity INT DEFAULT 50 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

-- 4. Orders Table (الطلبات)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL,
    customer_id TEXT REFERENCES customers(id),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    governorate VARCHAR(50) NOT NULL,
    city VARCHAR(50),
    district VARCHAR(50),
    address TEXT NOT NULL,
    notes TEXT,
    subtotal DECIMAL(10, 2) NOT NULL,
    delivery_fee DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    coupon_code VARCHAR(30),
    total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    deposit_required DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    deposit_paid DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    deposit_status VARCHAR(20) DEFAULT 'none' NOT NULL,
    deposit_transaction_ref VARCHAR(100),
    remaining_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'new' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 5. Order Items Table (عناصر الطلب المعتمدة)
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    variant_id TEXT REFERENCES product_variants(id),
    product_name VARCHAR(150) NOT NULL,
    variant_label VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    item_total DECIMAL(10, 2) NOT NULL,
    pieces_per_kilo_range VARCHAR(50),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 6. Coupons Table (كوبونات الخصم)
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2),
    max_discount DECIMAL(10, 2),
    usage_limit INT,
    usage_count INT DEFAULT 0,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- 7. Delivery Regions (مناطق التوصيل)
CREATE TABLE IF NOT EXISTS delivery_regions (
    id TEXT PRIMARY KEY,
    governorate VARCHAR(50) NOT NULL,
    cities TEXT[] NOT NULL,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    estimated_time VARCHAR(50),
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- 8. Store Settings (إعدادات المتجر وساعات الإغلاق)
CREATE TABLE IF NOT EXISTS store_settings (
    id INT PRIMARY KEY DEFAULT 1,
    cutoff_hour INT DEFAULT 3,
    cutoff_minute INT DEFAULT 0,
    is_store_open BOOLEAN DEFAULT true,
    minimum_order_amount DECIMAL(10, 2) DEFAULT 0,
    whatsapp_number VARCHAR(20) DEFAULT '01015192040',
    instapay_number VARCHAR(50) DEFAULT '01015192040',
    vodafone_cash_number VARCHAR(20) DEFAULT '01015192040',
    default_deposit_type VARCHAR(20) DEFAULT 'percentage',
    default_deposit_value DECIMAL(10, 2) DEFAULT 20,
    allow_coupons BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
