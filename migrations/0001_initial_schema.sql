-- Fredo TaxPOS System - Initial Database Schema
-- Created: 2024-12-14

-- ============================================
-- BUSINESSES TABLE
-- Stores business/organization information
-- ============================================
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tin TEXT UNIQUE NOT NULL, -- Tax Identification Number
  business_name TEXT NOT NULL,
  trade_name TEXT,
  address TEXT,
  city TEXT DEFAULT 'Addis Ababa',
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  business_type TEXT, -- 'retail', 'restaurant', 'service', 'wholesale', etc.
  tax_type TEXT DEFAULT 'vat', -- 'vat', 'turnover', 'both'
  vat_rate REAL DEFAULT 0.15, -- 15% VAT
  turnover_tax_rate REAL DEFAULT 0.02, -- 2% Turnover Tax
  subscription_status TEXT DEFAULT 'active', -- 'active', 'suspended', 'trial'
  subscription_tier TEXT DEFAULT 'basic', -- 'basic', 'pro', 'enterprise'
  erca_sync_enabled INTEGER DEFAULT 1, -- 1 = enabled, 0 = disabled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS TABLE
-- Business owners, managers, cashiers
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'cashier', -- 'owner', 'manager', 'cashier'
  pin TEXT, -- Encrypted 4-6 digit PIN
  permissions TEXT, -- JSON: {"can_issue_refunds": true, "can_view_reports": false}
  is_active INTEGER DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ============================================
-- PRODUCTS/SERVICES TABLE
-- Items for sale
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT, -- Stock Keeping Unit
  barcode TEXT,
  category TEXT, -- 'electronics', 'food', 'clothing', etc.
  price REAL NOT NULL,
  cost REAL, -- Cost of goods (for profit calculation)
  tax_category TEXT DEFAULT 'vat', -- 'vat', 'excise', 'exempt'
  excise_tax_rate REAL DEFAULT 0, -- For alcohol, tobacco, luxury goods
  unit TEXT DEFAULT 'pcs', -- 'pcs', 'kg', 'liter', etc.
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  image_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ============================================
-- SALES/TRANSACTIONS TABLE
-- Main sales records
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL, -- INV-2024-0001
  user_id INTEGER NOT NULL, -- Cashier who made the sale
  customer_name TEXT,
  customer_phone TEXT,
  customer_tin TEXT, -- For B2B sales
  sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  subtotal REAL NOT NULL, -- Before tax
  vat_amount REAL DEFAULT 0,
  turnover_tax_amount REAL DEFAULT 0,
  excise_tax_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL, -- Final amount including all taxes
  discount_amount REAL DEFAULT 0,
  payment_method TEXT NOT NULL, -- 'cash', 'telebirr', 'm-pesa', 'bank_transfer', 'card'
  payment_reference TEXT, -- Transaction ID from mobile money or bank
  amount_paid REAL NOT NULL,
  change_given REAL DEFAULT 0,
  shift_id INTEGER, -- Reference to shift
  status TEXT DEFAULT 'completed', -- 'completed', 'refunded', 'partially_refunded'
  notes TEXT,
  qr_code TEXT, -- Unique QR code for invoice verification
  erca_sync_status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'failed'
  erca_sync_date DATETIME,
  receipt_printed INTEGER DEFAULT 0, -- 1 = printed, 0 = not printed
  receipt_sent_sms INTEGER DEFAULT 0,
  receipt_sent_whatsapp INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- SALE_ITEMS TABLE
-- Individual items in each sale
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL, -- Snapshot at time of sale
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL, -- quantity * unit_price
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- SHIFTS TABLE
-- Cashier shift management
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  shift_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  shift_end DATETIME,
  starting_cash REAL DEFAULT 0,
  ending_cash REAL,
  expected_cash REAL, -- Calculated from sales
  cash_difference REAL, -- ending_cash - expected_cash
  total_sales REAL DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open', -- 'open', 'closed'
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- INVENTORY_TRANSACTIONS TABLE
-- Track inventory changes (stock in, stock out, adjustments)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- 'purchase', 'sale', 'adjustment', 'return'
  quantity INTEGER NOT NULL, -- Positive for stock in, negative for stock out
  reference_id INTEGER, -- Reference to sale_id if transaction_type='sale'
  notes TEXT,
  created_by INTEGER, -- user_id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- TAX_FILINGS TABLE
-- Record of tax returns filed with ERCA
-- ============================================
CREATE TABLE IF NOT EXISTS tax_filings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  filing_period TEXT NOT NULL, -- '2024-12', '2024-Q4'
  filing_type TEXT NOT NULL, -- 'vat_monthly', 'vat_quarterly', 'turnover_tax'
  total_sales REAL NOT NULL,
  taxable_sales REAL NOT NULL,
  tax_collected REAL NOT NULL,
  tax_paid REAL DEFAULT 0,
  filing_status TEXT DEFAULT 'draft', -- 'draft', 'filed', 'paid', 'overdue'
  filed_date DATETIME,
  payment_date DATETIME,
  payment_method TEXT, -- 'telebirr', 'm-pesa', 'bank_transfer'
  payment_reference TEXT,
  erca_reference TEXT, -- ERCA confirmation reference
  due_date DATE,
  certificate_url TEXT, -- Tax clearance certificate
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ============================================
-- ERCA_SYNC_LOG TABLE
-- Log of all sync attempts with ERCA
-- ============================================
CREATE TABLE IF NOT EXISTS erca_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  sync_type TEXT NOT NULL, -- 'invoice', 'tax_filing', 'payment'
  reference_id INTEGER NOT NULL, -- sale_id or tax_filing_id
  sync_status TEXT NOT NULL, -- 'success', 'failed', 'pending'
  request_data TEXT, -- JSON of data sent
  response_data TEXT, -- JSON of ERCA response
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ============================================
-- PRINTER_CONFIGS TABLE
-- Bluetooth printer configurations
-- ============================================
CREATE TABLE IF NOT EXISTS printer_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  printer_name TEXT NOT NULL,
  printer_mac_address TEXT,
  printer_type TEXT DEFAULT 'bluetooth', -- 'bluetooth', 'network'
  paper_width INTEGER DEFAULT 58, -- 58mm or 80mm
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  last_used DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- ============================================
-- SETTINGS TABLE
-- Business-specific settings
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE(business_id, setting_key)
);

-- ============================================
-- INDEXES for performance optimization
-- ============================================

-- Businesses
CREATE INDEX IF NOT EXISTS idx_businesses_tin ON businesses(tin);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_erca_sync_status ON sales(erca_sync_status);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);

-- Sale Items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_business_id ON shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- Inventory Transactions
CREATE INDEX IF NOT EXISTS idx_inventory_business_id ON inventory_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory_transactions(product_id);

-- Tax Filings
CREATE INDEX IF NOT EXISTS idx_tax_filings_business_id ON tax_filings(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_filings_period ON tax_filings(filing_period);

-- ERCA Sync Log
CREATE INDEX IF NOT EXISTS idx_erca_sync_business_id ON erca_sync_log(business_id);
CREATE INDEX IF NOT EXISTS idx_erca_sync_status ON erca_sync_log(sync_status);
