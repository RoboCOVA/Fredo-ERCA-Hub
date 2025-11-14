-- Fredo TaxPOS System - Seed Data for Demo/Testing
-- This file creates sample data for demonstration purposes

-- ============================================
-- SAMPLE BUSINESSES
-- ============================================
INSERT OR IGNORE INTO businesses (id, tin, business_name, trade_name, address, city, phone, email, business_type, tax_type) VALUES 
(1, '0012345678', 'Tsehay Electronics PLC', 'Tsehay Electronics', 'Bole Road, Near Edna Mall', 'Addis Ababa', '+251911123456', 'tsehay@electronics.et', 'retail', 'vat'),
(2, '0087654321', 'Meskel Café & Restaurant', 'Meskel Café', 'Meskel Square, Ground Floor', 'Addis Ababa', '+251922334455', 'info@meskelcafe.et', 'restaurant', 'vat'),
(3, '0011223344', 'Abyssinia Fashion Boutique', 'Abyssinia Fashion', 'Piazza, Churchill Avenue', 'Addis Ababa', '+251933445566', 'fashion@abyssinia.et', 'retail', 'turnover');

-- ============================================
-- SAMPLE USERS (Business Owners & Staff)
-- ============================================
INSERT OR IGNORE INTO users (id, business_id, full_name, phone, email, role, pin, is_active) VALUES 
(1, 1, 'Tsehay Mengistu', '+251911123456', 'tsehay@electronics.et', 'owner', '1234', 1),
(2, 1, 'Abebe Kebede', '+251911123457', 'abebe@electronics.et', 'cashier', '5678', 1),
(3, 2, 'Almaz Tadesse', '+251922334455', 'almaz@meskelcafe.et', 'owner', '1111', 1),
(4, 2, 'Yohannes Desta', '+251922334456', 'yohannes@meskelcafe.et', 'manager', '2222', 1),
(5, 3, 'Hanna Assefa', '+251933445566', 'hanna@abyssinia.et', 'owner', '9999', 1);

-- ============================================
-- SAMPLE PRODUCTS
-- ============================================

-- Tsehay Electronics Products
INSERT OR IGNORE INTO products (business_id, name, description, sku, barcode, category, price, cost, tax_category, unit, stock_quantity) VALUES 
(1, 'Samsung Galaxy A54', 'Android smartphone, 128GB', 'SAMS-A54-128', '8806094935820', 'electronics', 25000.00, 20000.00, 'vat', 'pcs', 15),
(1, 'iPhone 13', 'Apple smartphone, 128GB', 'APPL-IP13-128', '194252707319', 'electronics', 55000.00, 45000.00, 'vat', 'pcs', 8),
(1, 'USB-C Cable', 'Fast charging cable, 2m', 'ACC-USBC-2M', '1234567890123', 'accessories', 250.00, 150.00, 'vat', 'pcs', 100),
(1, 'Phone Case', 'Protective silicone case', 'ACC-CASE-SIL', '1234567890124', 'accessories', 300.00, 180.00, 'vat', 'pcs', 50),
(1, 'Wireless Earbuds', 'Bluetooth 5.0 earbuds', 'AUDIO-EARB-BT5', '1234567890125', 'electronics', 1500.00, 1000.00, 'vat', 'pcs', 25),
(1, 'Power Bank 20000mAh', 'Fast charging power bank', 'ACC-PWR-20K', '1234567890126', 'accessories', 1200.00, 800.00, 'vat', 'pcs', 30),
(1, 'Screen Protector', 'Tempered glass screen protector', 'ACC-SCRN-PROT', '1234567890127', 'accessories', 150.00, 80.00, 'vat', 'pcs', 75),
(1, 'Laptop HP 15', 'Intel i5, 8GB RAM, 256GB SSD', 'HP-LAP-15-I5', '1234567890128', 'electronics', 45000.00, 38000.00, 'vat', 'pcs', 5);

-- Meskel Café Products
INSERT OR IGNORE INTO products (business_id, name, description, category, price, cost, tax_category, unit, stock_quantity) VALUES 
(2, 'Espresso', 'Single shot espresso', 'beverages', 35.00, 15.00, 'vat', 'cup', 999),
(2, 'Cappuccino', 'Italian cappuccino', 'beverages', 50.00, 22.00, 'vat', 'cup', 999),
(2, 'Macchiato', 'Ethiopian coffee', 'beverages', 30.00, 12.00, 'vat', 'cup', 999),
(2, 'Fresh Juice', 'Avocado/Mango/Orange', 'beverages', 60.00, 25.00, 'vat', 'glass', 999),
(2, 'Tibs', 'Spicy beef tibs with injera', 'food', 180.00, 90.00, 'vat', 'plate', 999),
(2, 'Doro Wat', 'Traditional chicken stew', 'food', 200.00, 100.00, 'vat', 'plate', 999),
(2, 'Fasting Combo', 'Vegetarian platter', 'food', 120.00, 60.00, 'vat', 'plate', 999),
(2, 'Sambusa', 'Fried pastry (3 pieces)', 'snacks', 30.00, 12.00, 'vat', 'order', 999),
(2, 'Cake Slice', 'Chocolate/Vanilla cake', 'desserts', 45.00, 20.00, 'vat', 'slice', 999);

-- Abyssinia Fashion Products
INSERT OR IGNORE INTO products (business_id, name, description, category, price, cost, tax_category, unit, stock_quantity) VALUES 
(3, 'Traditional Habesha Kemis', 'White cotton dress with embroidery', 'clothing', 2500.00, 1500.00, 'turnover', 'pcs', 12),
(3, 'Netela Shawl', 'Traditional Ethiopian shawl', 'clothing', 800.00, 500.00, 'turnover', 'pcs', 20),
(3, 'Men Habesha Shirt', 'Traditional white shirt', 'clothing', 1200.00, 700.00, 'turnover', 'pcs', 15),
(3, 'Kids Habesha Dress', 'Children traditional dress', 'clothing', 1500.00, 900.00, 'turnover', 'pcs', 10),
(3, 'Ethiopian Cross Necklace', 'Silver plated cross', 'accessories', 600.00, 350.00, 'turnover', 'pcs', 25);

-- ============================================
-- SAMPLE SALES (Historical Data)
-- ============================================

-- Recent sales for Tsehay Electronics
INSERT OR IGNORE INTO sales (id, business_id, invoice_number, user_id, sale_date, subtotal, vat_amount, total_amount, payment_method, amount_paid, shift_id, status, qr_code, erca_sync_status) VALUES 
(1, 1, 'INV-2024-0001', 1, '2024-12-10 09:30:00', 10800.00, 1620.00, 12420.00, 'telebirr', 12420.00, NULL, 'completed', 'QR-INV-2024-0001', 'synced'),
(2, 1, 'INV-2024-0002', 2, '2024-12-10 10:45:00', 25000.00, 3750.00, 28750.00, 'cash', 30000.00, NULL, 'completed', 'QR-INV-2024-0002', 'synced'),
(3, 1, 'INV-2024-0003', 2, '2024-12-10 11:20:00', 1950.00, 292.50, 2242.50, 'm-pesa', 2242.50, NULL, 'completed', 'QR-INV-2024-0003', 'synced'),
(4, 1, 'INV-2024-0004', 1, '2024-12-10 14:15:00', 55000.00, 8250.00, 63250.00, 'bank_transfer', 63250.00, NULL, 'completed', 'QR-INV-2024-0004', 'synced'),
(5, 1, 'INV-2024-0005', 2, '2024-12-11 09:00:00', 1500.00, 225.00, 1725.00, 'cash', 2000.00, NULL, 'completed', 'QR-INV-2024-0005', 'pending');

-- Sale items for the above sales
INSERT OR IGNORE INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, line_total, tax_amount) VALUES 
-- Sale 1 items
(1, 1, 'Samsung Galaxy A54', 1, 10000.00, 10000.00, 1500.00),
(1, 3, 'USB-C Cable', 2, 250.00, 500.00, 75.00),
(1, 4, 'Phone Case', 1, 300.00, 300.00, 45.00),

-- Sale 2 items
(2, 1, 'Samsung Galaxy A54', 1, 25000.00, 25000.00, 3750.00),

-- Sale 3 items
(3, 3, 'USB-C Cable', 3, 250.00, 750.00, 112.50),
(3, 5, 'Wireless Earbuds', 1, 1200.00, 1200.00, 180.00),

-- Sale 4 items
(4, 2, 'iPhone 13', 1, 55000.00, 55000.00, 8250.00),

-- Sale 5 items
(5, 5, 'Wireless Earbuds', 1, 1500.00, 1500.00, 225.00);

-- Sales for Meskel Café (Today's sales)
INSERT OR IGNORE INTO sales (id, business_id, invoice_number, user_id, sale_date, subtotal, vat_amount, total_amount, payment_method, amount_paid, status, qr_code, erca_sync_status) VALUES 
(6, 2, 'MCF-2024-0101', 3, '2024-12-14 08:30:00', 130.00, 19.50, 149.50, 'cash', 150.00, 'completed', 'QR-MCF-2024-0101', 'pending'),
(7, 2, 'MCF-2024-0102', 4, '2024-12-14 09:15:00', 380.00, 57.00, 437.00, 'telebirr', 437.00, 'completed', 'QR-MCF-2024-0102', 'pending'),
(8, 2, 'MCF-2024-0103', 4, '2024-12-14 10:00:00', 100.00, 15.00, 115.00, 'cash', 115.00, 'completed', 'QR-MCF-2024-0103', 'pending');

INSERT OR IGNORE INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, line_total, tax_amount) VALUES 
-- Café sale 1
(6, 10, 'Cappuccino', 2, 50.00, 100.00, 15.00),
(6, 17, 'Sambusa', 1, 30.00, 30.00, 4.50),

-- Café sale 2
(7, 14, 'Tibs', 2, 180.00, 360.00, 54.00),
(7, 12, 'Macchiato', 1, 20.00, 20.00, 3.00),

-- Café sale 3
(8, 11, 'Macchiato', 2, 30.00, 60.00, 9.00),
(8, 18, 'Cake Slice', 1, 40.00, 40.00, 6.00);

-- ============================================
-- SAMPLE SHIFTS
-- ============================================
INSERT OR IGNORE INTO shifts (id, business_id, user_id, shift_start, shift_end, starting_cash, ending_cash, expected_cash, total_sales, total_transactions, status) VALUES 
(1, 1, 2, '2024-12-10 08:00:00', '2024-12-10 18:00:00', 5000.00, 42000.00, 42242.50, 43712.50, 3, 'closed'),
(2, 2, 4, '2024-12-14 08:00:00', NULL, 3000.00, NULL, NULL, 437.00, 2, 'open');

-- ============================================
-- SAMPLE TAX FILINGS
-- ============================================
INSERT OR IGNORE INTO tax_filings (business_id, filing_period, filing_type, total_sales, taxable_sales, tax_collected, tax_paid, filing_status, due_date) VALUES 
(1, '2024-11', 'vat_monthly', 850000.00, 850000.00, 127500.00, 127500.00, 'paid', '2024-12-15'),
(1, '2024-12', 'vat_monthly', 0.00, 0.00, 0.00, 0.00, 'draft', '2025-01-15'),
(2, '2024-11', 'vat_monthly', 320000.00, 320000.00, 48000.00, 48000.00, 'paid', '2024-12-15');

-- ============================================
-- SAMPLE SETTINGS
-- ============================================
INSERT OR IGNORE INTO settings (business_id, setting_key, setting_value) VALUES 
(1, 'receipt_footer', 'Thank you for your business! Visit Again Soon!'),
(1, 'default_language', 'en'),
(1, 'currency_symbol', 'ETB'),
(1, 'low_stock_alert_enabled', '1'),
(2, 'receipt_footer', 'Enjoy your meal! Come back soon!'),
(2, 'default_language', 'am'),
(3, 'receipt_footer', 'እናመሰግናለን! (Thank you!)'),
(3, 'default_language', 'am');

-- ============================================
-- ERCA GOVERNMENT ADMIN USER (For Revenue Hub)
-- ============================================
INSERT OR IGNORE INTO users (id, business_id, full_name, phone, email, role, pin, is_active) VALUES 
(100, 1, 'ERCA Administrator', '+251911000000', 'admin@erca.gov.et', 'erca_admin', '0000', 1);
