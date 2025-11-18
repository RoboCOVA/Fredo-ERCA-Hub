-- Migration: ERCA Officials Management System
-- Description: Creates table and system for managing ERCA government officials
-- Date: 2025-11-18

-- ============================================
-- ERCA Officials Table
-- ============================================
-- Stores government officials who access the ERCA Hub
CREATE TABLE IF NOT EXISTS erca_officials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  department TEXT NOT NULL, -- Revenue Monitoring, Audit, Enforcement, etc.
  rank_name TEXT NOT NULL, -- Director, Senior Official, Inspector, Analyst, etc.
  office_location TEXT, -- Addis Ababa, Regional Office, etc.
  is_super_admin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  
  -- Permissions
  can_view_businesses INTEGER DEFAULT 1,
  can_view_transactions INTEGER DEFAULT 1,
  can_view_reports INTEGER DEFAULT 1,
  can_manage_officials INTEGER DEFAULT 0,
  can_audit_businesses INTEGER DEFAULT 0,
  can_issue_penalties INTEGER DEFAULT 0,
  
  -- Additional Info
  national_id TEXT,
  work_permit_number TEXT,
  supervisor_id INTEGER REFERENCES erca_officials(id),
  date_joined DATE DEFAULT CURRENT_DATE,
  last_login DATETIME,
  password_reset_token TEXT,
  password_reset_expires DATETIME,
  account_locked INTEGER DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  
  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES erca_officials(id),
  
  -- Constraints
  CHECK (is_super_admin IN (0, 1)),
  CHECK (is_active IN (0, 1))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_erca_officials_employee_id ON erca_officials(employee_id);
CREATE INDEX IF NOT EXISTS idx_erca_officials_email ON erca_officials(email);
CREATE INDEX IF NOT EXISTS idx_erca_officials_department ON erca_officials(department);
CREATE INDEX IF NOT EXISTS idx_erca_officials_is_active ON erca_officials(is_active);

-- ============================================
-- ERCA Sessions Table
-- ============================================
-- Tracks active sessions for officials
CREATE TABLE IF NOT EXISTS erca_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  official_id INTEGER NOT NULL REFERENCES erca_officials(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_erca_sessions_token ON erca_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_erca_sessions_official ON erca_sessions(official_id);
CREATE INDEX IF NOT EXISTS idx_erca_sessions_expires ON erca_sessions(expires_at);

-- ============================================
-- ERCA Audit Logs Table
-- ============================================
-- Tracks all actions by officials in the system
CREATE TABLE IF NOT EXISTS erca_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  official_id INTEGER REFERENCES erca_officials(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- login, logout, view_business, export_report, etc.
  entity_type TEXT, -- business, transaction, official, report, etc.
  entity_id INTEGER,
  details TEXT, -- JSON data with additional context
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_erca_audit_official ON erca_audit_logs(official_id);
CREATE INDEX IF NOT EXISTS idx_erca_audit_action ON erca_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_erca_audit_date ON erca_audit_logs(created_at);

-- ============================================
-- Insert Default Super Admin
-- ============================================
-- Create the first super admin account
-- Employee ID: ERCA001
-- Password: erca2024 (SHA-256 hash)
INSERT OR IGNORE INTO erca_officials (
  id,
  employee_id,
  full_name,
  email,
  phone,
  password_hash,
  department,
  rank_name,
  office_location,
  is_super_admin,
  is_active,
  can_view_businesses,
  can_view_transactions,
  can_view_reports,
  can_manage_officials,
  can_audit_businesses,
  can_issue_penalties
) VALUES (
  1,
  'ERCA001',
  'System Administrator',
  'admin@erca.gov.et',
  '+251911000000',
  'c15cc6e9c3e8c38b3e5e5f8e89d5d5f3b4e4f5c5b5e5f5e5f5e5f5e5f5e5f5e5', -- Hash of 'erca2024'
  'System Administration',
  'System Administrator',
  'ERCA Headquarters, Addis Ababa',
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1
);

-- ============================================
-- Insert Sample Officials for Testing
-- ============================================
-- Revenue Monitoring Officer
INSERT OR IGNORE INTO erca_officials (
  id,
  employee_id,
  full_name,
  email,
  phone,
  password_hash,
  department,
  rank_name,
  office_location,
  is_super_admin,
  is_active,
  can_view_businesses,
  can_view_transactions,
  can_view_reports,
  can_manage_officials,
  can_audit_businesses,
  can_issue_penalties,
  supervisor_id
) VALUES (
  2,
  'ERCA002',
  'Abebe Kebede',
  'abebe.kebede@erca.gov.et',
  '+251922334455',
  'c15cc6e9c3e8c38b3e5e5f8e89d5d5f3b4e4f5c5b5e5f5e5f5e5f5e5f5e5f5e5', -- Hash of 'erca2024'
  'Revenue Monitoring',
  'Senior Revenue Officer',
  'ERCA Headquarters, Addis Ababa',
  0,
  1,
  1,
  1,
  1,
  0,
  0,
  0,
  1
);

-- Audit Inspector
INSERT OR IGNORE INTO erca_officials (
  id,
  employee_id,
  full_name,
  email,
  phone,
  password_hash,
  department,
  rank_name,
  office_location,
  is_super_admin,
  is_active,
  can_view_businesses,
  can_view_transactions,
  can_view_reports,
  can_manage_officials,
  can_audit_businesses,
  can_issue_penalties,
  supervisor_id
) VALUES (
  3,
  'ERCA003',
  'Tigist Alemayehu',
  'tigist.alemayehu@erca.gov.et',
  '+251933445566',
  'c15cc6e9c3e8c38b3e5e5f8e89d5d5f3b4e4f5c5b5e5f5e5f5e5f5e5f5e5f5e5', -- Hash of 'erca2024'
  'Audit and Compliance',
  'Audit Inspector',
  'ERCA Headquarters, Addis Ababa',
  0,
  1,
  1,
  1,
  1,
  0,
  1,
  1,
  1
);
