-- Migration: ERCA User Management System
-- Description: Create tables for ERCA officials with government hierarchy

-- ERCA Officials Table
CREATE TABLE IF NOT EXISTS erca_officials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  rank TEXT NOT NULL, -- cg, dcg, dg, dir, dd, tl, so, off, ao
  department TEXT, -- Revenue, Customs, Audit, Compliance, IT
  region TEXT, -- Addis Ababa, Oromia, Amhara, etc.
  office_location TEXT,
  is_super_admin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  created_by INTEGER,
  FOREIGN KEY (created_by) REFERENCES erca_officials(id)
);

-- ERCA Rank Definitions
CREATE TABLE IF NOT EXISTS erca_ranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rank_code TEXT UNIQUE NOT NULL,
  rank_name TEXT NOT NULL,
  rank_level INTEGER NOT NULL, -- 1 (highest) to 9 (lowest)
  description TEXT,
  can_manage_users INTEGER DEFAULT 0,
  can_audit_businesses INTEGER DEFAULT 0,
  can_verify_invoices INTEGER DEFAULT 0,
  can_generate_reports INTEGER DEFAULT 0,
  can_configure_system INTEGER DEFAULT 0
);

-- Insert rank definitions
INSERT OR IGNORE INTO erca_ranks (rank_code, rank_name, rank_level, description, can_manage_users, can_audit_businesses, can_verify_invoices, can_generate_reports, can_configure_system) VALUES
  ('cg', 'Commissioner General', 1, 'Highest authority - Full system access', 1, 1, 1, 1, 1),
  ('dcg', 'Deputy Commissioner General', 2, 'Regional oversight and policy', 1, 1, 1, 1, 1),
  ('dg', 'Director General', 3, 'Department head', 1, 1, 1, 1, 0),
  ('dir', 'Director', 4, 'Division head', 1, 1, 1, 1, 0),
  ('dd', 'Deputy Director', 5, 'Team oversight', 0, 1, 1, 1, 0),
  ('tl', 'Team Leader', 6, 'Team management', 0, 1, 1, 1, 0),
  ('so', 'Senior Officer', 7, 'Senior operational tasks', 0, 1, 1, 1, 0),
  ('off', 'Officer', 8, 'Regular operational tasks', 0, 0, 1, 0, 0),
  ('ao', 'Assistant Officer', 9, 'Basic operational tasks', 0, 0, 1, 0, 0);

-- ERCA Sessions Table
CREATE TABLE IF NOT EXISTS erca_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  official_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (official_id) REFERENCES erca_officials(id) ON DELETE CASCADE
);

-- ERCA Audit Log Table
CREATE TABLE IF NOT EXISTS erca_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  official_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- login, logout, create_user, view_business, verify_invoice, etc.
  entity_type TEXT, -- business, invoice, user, report
  entity_id INTEGER,
  details TEXT, -- JSON string with additional details
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (official_id) REFERENCES erca_officials(id)
);

-- ERCA Permissions Table (for granular permissions)
CREATE TABLE IF NOT EXISTS erca_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rank_code TEXT NOT NULL,
  permission_name TEXT NOT NULL,
  description TEXT,
  UNIQUE(rank_code, permission_name),
  FOREIGN KEY (rank_code) REFERENCES erca_ranks(rank_code)
);

-- Insert default permissions
INSERT OR IGNORE INTO erca_permissions (rank_code, permission_name, description) VALUES
  -- Commissioner General (all permissions)
  ('cg', 'system.admin', 'Full system administration'),
  ('cg', 'users.manage', 'Manage all users'),
  ('cg', 'businesses.audit', 'Audit any business'),
  ('cg', 'reports.generate', 'Generate all reports'),
  ('cg', 'invoices.verify', 'Verify invoices'),
  ('cg', 'system.configure', 'Configure system settings'),
  
  -- Deputy Commissioner General
  ('dcg', 'users.manage', 'Manage users in region'),
  ('dcg', 'businesses.audit', 'Audit businesses in region'),
  ('dcg', 'reports.generate', 'Generate regional reports'),
  ('dcg', 'invoices.verify', 'Verify invoices'),
  
  -- Director General
  ('dg', 'users.manage', 'Manage department users'),
  ('dg', 'businesses.audit', 'Audit businesses'),
  ('dg', 'reports.generate', 'Generate department reports'),
  ('dg', 'invoices.verify', 'Verify invoices'),
  
  -- Director
  ('dir', 'users.manage', 'Manage division users'),
  ('dir', 'businesses.audit', 'Audit businesses in division'),
  ('dir', 'reports.generate', 'Generate division reports'),
  ('dir', 'invoices.verify', 'Verify invoices'),
  
  -- Deputy Director
  ('dd', 'businesses.audit', 'Audit assigned businesses'),
  ('dd', 'reports.generate', 'Generate team reports'),
  ('dd', 'invoices.verify', 'Verify invoices'),
  
  -- Team Leader
  ('tl', 'businesses.audit', 'Audit assigned businesses'),
  ('tl', 'reports.generate', 'Generate team reports'),
  ('tl', 'invoices.verify', 'Verify invoices'),
  
  -- Senior Officer
  ('so', 'businesses.audit', 'Audit assigned businesses'),
  ('so', 'reports.view', 'View reports'),
  ('so', 'invoices.verify', 'Verify invoices'),
  
  -- Officer
  ('off', 'businesses.view', 'View business data'),
  ('off', 'invoices.verify', 'Verify invoices'),
  
  -- Assistant Officer
  ('ao', 'businesses.view', 'View business data'),
  ('ao', 'invoices.verify', 'Verify invoices');

-- ERCA Departments Table
CREATE TABLE IF NOT EXISTS erca_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_name TEXT UNIQUE NOT NULL,
  department_code TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_department_id INTEGER,
  head_official_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_department_id) REFERENCES erca_departments(id),
  FOREIGN KEY (head_official_id) REFERENCES erca_officials(id)
);

-- Insert default departments
INSERT OR IGNORE INTO erca_departments (department_name, department_code, description) VALUES
  ('Revenue Monitoring', 'REV', 'Tax revenue collection and monitoring'),
  ('Customs Operations', 'CUST', 'Import/Export customs management'),
  ('Audit and Investigation', 'AUDIT', 'Tax audit and compliance investigation'),
  ('Compliance and Enforcement', 'COMP', 'Tax compliance enforcement'),
  ('Information Technology', 'IT', 'IT infrastructure and systems'),
  ('Legal Affairs', 'LEGAL', 'Legal matters and dispute resolution'),
  ('Human Resources', 'HR', 'Personnel management'),
  ('Finance and Administration', 'FIN', 'Financial management');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_erca_officials_email ON erca_officials(email);
CREATE INDEX IF NOT EXISTS idx_erca_officials_employee_id ON erca_officials(employee_id);
CREATE INDEX IF NOT EXISTS idx_erca_officials_rank ON erca_officials(rank);
CREATE INDEX IF NOT EXISTS idx_erca_sessions_token ON erca_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_erca_sessions_official ON erca_sessions(official_id);
CREATE INDEX IF NOT EXISTS idx_erca_audit_log_official ON erca_audit_log(official_id);
CREATE INDEX IF NOT EXISTS idx_erca_audit_log_action ON erca_audit_log(action);
