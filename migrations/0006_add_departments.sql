-- Migration: Add ERCA Departments Table
-- Description: Create departments table and populate with default Ethiopian government departments

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
