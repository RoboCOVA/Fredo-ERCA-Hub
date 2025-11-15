-- Migration 0003: Business Onboarding & ERCA Analytics (v2 - Safe Migration)
-- Phase 3: Enhanced business classification, location tracking, and ERCA revenue analytics
-- This migration safely adds only columns that don't exist

-- ============================================
-- PART 1: ENHANCE BUSINESSES TABLE (Safe Additions Only)
-- ============================================

-- Add business size classification (business_type already exists)
ALTER TABLE businesses ADD COLUMN business_size TEXT DEFAULT 'small' CHECK(business_size IN ('micro', 'small', 'medium', 'large'));
ALTER TABLE businesses ADD COLUMN annual_revenue_range TEXT;

-- Add registration and licensing information
ALTER TABLE businesses ADD COLUMN registration_number TEXT;
ALTER TABLE businesses ADD COLUMN trade_license_number TEXT;
ALTER TABLE businesses ADD COLUMN tax_registration_date DATE;

-- Add business operational details
ALTER TABLE businesses ADD COLUMN num_employees INTEGER DEFAULT 1;
ALTER TABLE businesses ADD COLUMN operating_hours TEXT; -- JSON: {"monday": "08:00-17:00", ...}
ALTER TABLE businesses ADD COLUMN business_logo TEXT; -- URL to uploaded logo

-- Add location information (city already exists, add others)
ALTER TABLE businesses ADD COLUMN region TEXT; -- Addis Ababa, Oromia, Amhara, etc.
ALTER TABLE businesses ADD COLUMN sub_city TEXT; -- Woreda
ALTER TABLE businesses ADD COLUMN kebele TEXT;
ALTER TABLE businesses ADD COLUMN street_address TEXT;
ALTER TABLE businesses ADD COLUMN gps_latitude REAL;
ALTER TABLE businesses ADD COLUMN gps_longitude REAL;
ALTER TABLE businesses ADD COLUMN postal_code TEXT;

-- Add contact person details
ALTER TABLE businesses ADD COLUMN contact_person_name TEXT;
ALTER TABLE businesses ADD COLUMN contact_person_role TEXT;
ALTER TABLE businesses ADD COLUMN website TEXT;

-- Add onboarding status
ALTER TABLE businesses ADD COLUMN onboarding_completed INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN onboarding_completed_at DATETIME;

-- ============================================
-- PART 2: ERCA REVENUE ANALYTICS TABLES
-- ============================================

-- Daily aggregated analytics by location and business classification
CREATE TABLE IF NOT EXISTS erca_daily_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analytics_date DATE NOT NULL,
  
  -- Location dimensions
  region TEXT,
  city TEXT,
  sub_city TEXT,
  
  -- Business dimensions
  business_type TEXT,
  business_size TEXT,
  
  -- Revenue metrics
  total_revenue REAL DEFAULT 0,
  total_tax REAL DEFAULT 0,
  vat_collected REAL DEFAULT 0,
  turnover_tax_collected REAL DEFAULT 0,
  excise_tax_collected REAL DEFAULT 0,
  
  -- Transaction metrics
  num_transactions INTEGER DEFAULT 0,
  num_businesses INTEGER DEFAULT 0,
  avg_transaction_value REAL DEFAULT 0,
  
  -- Compliance metrics
  num_synced_transactions INTEGER DEFAULT 0,
  num_pending_sync INTEGER DEFAULT 0,
  num_failed_sync INTEGER DEFAULT 0,
  compliance_rate REAL DEFAULT 0, -- Percentage of synced transactions
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicates
  UNIQUE(analytics_date, region, city, sub_city, business_type, business_size)
);

-- Create indexes for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_erca_daily_analytics_date ON erca_daily_analytics(analytics_date DESC);
CREATE INDEX IF NOT EXISTS idx_erca_daily_analytics_region ON erca_daily_analytics(region);
CREATE INDEX IF NOT EXISTS idx_erca_daily_analytics_business_type ON erca_daily_analytics(business_type);
CREATE INDEX IF NOT EXISTS idx_erca_daily_analytics_business_size ON erca_daily_analytics(business_size);

-- Real-time analytics summary (updated on each sale)
CREATE TABLE IF NOT EXISTS erca_realtime_summary (
  id INTEGER PRIMARY KEY CHECK(id = 1), -- Single row table
  
  -- Overall metrics
  total_businesses INTEGER DEFAULT 0,
  active_businesses_today INTEGER DEFAULT 0,
  total_revenue_today REAL DEFAULT 0,
  total_tax_today REAL DEFAULT 0,
  total_transactions_today INTEGER DEFAULT 0,
  
  -- Compliance metrics
  pending_sync_count INTEGER DEFAULT 0,
  failed_sync_count INTEGER DEFAULT 0,
  overall_compliance_rate REAL DEFAULT 0,
  
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with one row
INSERT OR IGNORE INTO erca_realtime_summary (id) VALUES (1);

-- Regional analytics summary
CREATE TABLE IF NOT EXISTS erca_regional_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL UNIQUE,
  
  -- Metrics
  total_businesses INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_tax REAL DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  
  -- Top business type in this region
  top_business_type TEXT,
  top_business_type_revenue REAL DEFAULT 0,
  
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Business type analytics summary
CREATE TABLE IF NOT EXISTS erca_business_type_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_type TEXT NOT NULL UNIQUE,
  
  -- Metrics
  total_businesses INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_tax REAL DEFAULT 0,
  avg_transaction_value REAL DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Business size analytics summary
CREATE TABLE IF NOT EXISTS erca_business_size_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_size TEXT NOT NULL UNIQUE,
  
  -- Metrics
  total_businesses INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_tax REAL DEFAULT 0,
  avg_revenue_per_business REAL DEFAULT 0,
  compliance_rate REAL DEFAULT 0,
  
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PART 3: BUSINESS CATEGORIES REFERENCE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS business_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_code TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Font Awesome icon class
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Populate business categories
INSERT OR IGNORE INTO business_categories (category_code, category_name, description, icon) VALUES
  ('retail', 'Retail Store', 'General retail shops and stores', 'fa-store'),
  ('restaurant', 'Restaurant/Café', 'Restaurants, cafés, and food service', 'fa-utensils'),
  ('hotel', 'Hotel/Accommodation', 'Hotels, guest houses, and lodging', 'fa-hotel'),
  ('grocery', 'Grocery/Supermarket', 'Grocery stores and supermarkets', 'fa-shopping-cart'),
  ('pharmacy', 'Pharmacy', 'Pharmacies and drug stores', 'fa-pills'),
  ('electronics', 'Electronics Shop', 'Electronics and technology stores', 'fa-laptop'),
  ('fashion', 'Fashion/Clothing', 'Clothing, shoes, and fashion stores', 'fa-tshirt'),
  ('service', 'Service Provider', 'Service-based businesses', 'fa-hands-helping'),
  ('other', 'Other', 'Other business types', 'fa-building');

-- ============================================
-- PART 4: ETHIOPIAN REGIONS REFERENCE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ethiopian_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_code TEXT NOT NULL UNIQUE,
  region_name TEXT NOT NULL,
  capital_city TEXT,
  is_active INTEGER DEFAULT 1
);

-- Populate Ethiopian regions
INSERT OR IGNORE INTO ethiopian_regions (region_code, region_name, capital_city) VALUES
  ('AA', 'Addis Ababa', 'Addis Ababa'),
  ('OR', 'Oromia', 'Addis Ababa'),
  ('AM', 'Amhara', 'Bahir Dar'),
  ('TG', 'Tigray', 'Mekelle'),
  ('SN', 'Southern Nations, Nationalities, and Peoples', 'Hawassa'),
  ('SO', 'Somali', 'Jijiga'),
  ('BG', 'Benishangul-Gumuz', 'Assosa'),
  ('AF', 'Afar', 'Semera'),
  ('GM', 'Gambela', 'Gambela'),
  ('HR', 'Harari', 'Harar'),
  ('DD', 'Dire Dawa', 'Dire Dawa'),
  ('SD', 'Sidama', 'Hawassa'),
  ('SW', 'South West Ethiopia Peoples', 'Bonga');

-- ============================================
-- PART 5: VIEWS FOR COMMON ANALYTICS QUERIES
-- ============================================

-- View: Business Overview with Location
CREATE VIEW IF NOT EXISTS v_business_overview AS
SELECT 
  b.id,
  b.business_name,
  b.tin,
  b.business_type,
  b.business_size,
  b.region,
  b.city,
  b.sub_city,
  b.phone,
  b.email,
  b.onboarding_completed,
  bc.category_name as business_type_name,
  bc.icon as business_type_icon,
  COUNT(DISTINCT s.id) as total_sales,
  COALESCE(SUM(s.total_amount), 0) as total_revenue,
  COALESCE(SUM(s.vat_amount + s.turnover_tax_amount + COALESCE(s.excise_tax_amount, 0)), 0) as total_tax,
  b.created_at
FROM businesses b
LEFT JOIN business_categories bc ON b.business_type = bc.category_code
LEFT JOIN sales s ON b.id = s.business_id
GROUP BY b.id;

-- View: Regional Revenue Summary
CREATE VIEW IF NOT EXISTS v_regional_revenue AS
SELECT 
  b.region,
  er.region_name,
  COUNT(DISTINCT b.id) as num_businesses,
  COUNT(DISTINCT s.id) as num_transactions,
  COALESCE(SUM(s.total_amount), 0) as total_revenue,
  COALESCE(SUM(s.vat_amount + s.turnover_tax_amount), 0) as total_tax,
  COALESCE(AVG(s.total_amount), 0) as avg_transaction_value
FROM businesses b
LEFT JOIN ethiopian_regions er ON b.region = er.region_code
LEFT JOIN sales s ON b.id = s.business_id
WHERE b.region IS NOT NULL
GROUP BY b.region, er.region_name;

-- View: Business Type Revenue Summary
CREATE VIEW IF NOT EXISTS v_business_type_revenue AS
SELECT 
  b.business_type,
  bc.category_name,
  bc.icon,
  COUNT(DISTINCT b.id) as num_businesses,
  COUNT(DISTINCT s.id) as num_transactions,
  COALESCE(SUM(s.total_amount), 0) as total_revenue,
  COALESCE(SUM(s.vat_amount + s.turnover_tax_amount), 0) as total_tax,
  COALESCE(AVG(s.total_amount), 0) as avg_transaction_value
FROM businesses b
LEFT JOIN business_categories bc ON b.business_type = bc.category_code
LEFT JOIN sales s ON b.id = s.business_id
GROUP BY b.business_type, bc.category_name, bc.icon;

-- View: Business Size Revenue Summary
CREATE VIEW IF NOT EXISTS v_business_size_revenue AS
SELECT 
  b.business_size,
  COUNT(DISTINCT b.id) as num_businesses,
  COUNT(DISTINCT s.id) as num_transactions,
  COALESCE(SUM(s.total_amount), 0) as total_revenue,
  COALESCE(SUM(s.vat_amount + s.turnover_tax_amount), 0) as total_tax,
  COALESCE(AVG(s.total_amount), 0) as avg_transaction_value,
  COALESCE(SUM(s.total_amount) / NULLIF(COUNT(DISTINCT b.id), 0), 0) as avg_revenue_per_business
FROM businesses b
LEFT JOIN sales s ON b.id = s.business_id
WHERE b.business_size IS NOT NULL
GROUP BY b.business_size;

-- View: ERCA Compliance Dashboard
CREATE VIEW IF NOT EXISTS v_erca_compliance AS
SELECT 
  DATE(s.sale_date) as sale_date,
  b.region,
  b.business_type,
  b.business_size,
  COUNT(*) as total_transactions,
  SUM(CASE WHEN s.erca_sync_status = 'synced' THEN 1 ELSE 0 END) as synced_count,
  SUM(CASE WHEN s.erca_sync_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN s.erca_sync_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  ROUND(100.0 * SUM(CASE WHEN s.erca_sync_status = 'synced' THEN 1 ELSE 0 END) / COUNT(*), 2) as compliance_rate,
  SUM(s.total_amount) as total_revenue,
  SUM(s.vat_amount + s.turnover_tax_amount + COALESCE(s.excise_tax_amount, 0)) as total_tax
FROM sales s
JOIN businesses b ON s.business_id = b.id
WHERE s.sale_date >= DATE('now', '-30 days')
GROUP BY DATE(s.sale_date), b.region, b.business_type, b.business_size;
