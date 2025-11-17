# ERCA User Management System Documentation

## Overview

The ERCA User Management System provides comprehensive authentication, authorization, and user management for Ethiopian Revenue and Customs Authority officials. The system implements a 9-level government hierarchy with role-based permissions.

## Government Official Hierarchy (9 Levels)

```
Level 1: Commissioner General (CG)         - Full system access
  ├── Level 2: Deputy Commissioner General (DCG) - Regional oversight
  │   ├── Level 3: Director General (DG)   - Department head
  │   │   ├── Level 4: Director (DIR)      - Division head
  │   │   │   ├── Level 5: Deputy Director (DD) - Team oversight
  │   │   │   │   ├── Level 6: Team Leader (TL) - Team management
  │   │   │   │   │   ├── Level 7: Senior Officer (SO) - Senior tasks
  │   │   │   │   │   │   ├── Level 8: Officer (OFF) - Regular tasks
  │   │   │   │   │   │   │   └── Level 9: Assistant Officer (AO) - Basic tasks
```

## Database Tables

### 1. `erca_officials`
Stores all ERCA government officials with their credentials and profiles.

**Columns:**
- `id`: Primary key
- `full_name`: Official's full name
- `employee_id`: Unique employee ID (e.g., ERCA001)
- `email`: Official email address
- `phone`: Contact phone number
- `password_hash`: SHA-256 hashed password
- `rank`: Rank code (cg, dcg, dg, dir, dd, tl, so, off, ao)
- `department`: Department (Revenue, Customs, Audit, Compliance, IT)
- `region`: Geographic region (Addis Ababa, Oromia, Amhara, etc.)
- `office_location`: Specific office location
- `is_super_admin`: Super admin flag (1 or 0)
- `is_active`: Active status (1 or 0)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `last_login_at`: Last login timestamp
- `created_by`: ID of official who created this account

### 2. `erca_ranks`
Defines all government ranks and their permissions.

**Rank Codes:**
- `cg`: Commissioner General
- `dcg`: Deputy Commissioner General
- `dg`: Director General
- `dir`: Director
- `dd`: Deputy Director
- `tl`: Team Leader
- `so`: Senior Officer
- `off`: Officer
- `ao`: Assistant Officer

**Permissions per Rank:**
- `can_manage_users`: Create/edit/delete users
- `can_audit_businesses`: Conduct business audits
- `can_verify_invoices`: Verify invoices
- `can_generate_reports`: Generate reports
- `can_configure_system`: System configuration access

### 3. `erca_sessions`
Active sessions for authenticated officials.

### 4. `erca_audit_log`
Complete audit trail of all official actions.

### 5. `erca_permissions`
Granular permissions for each rank.

### 6. `erca_departments`
ERCA departments structure.

**Default Departments:**
- Revenue Monitoring (REV)
- Customs Operations (CUST)
- Audit and Investigation (AUDIT)
- Compliance and Enforcement (COMP)
- Information Technology (IT)
- Legal Affairs (LEGAL)
- Human Resources (HR)
- Finance and Administration (FIN)

## API Endpoints

### Authentication

#### 1. Setup Super Admin (One-time only)
**Endpoint:** `POST /api/erca/admin/setup`

**Request:**
```json
{
  "full_name": "Commissioner General",
  "employee_id": "ERCA001",
  "email": "cg@erca.gov.et",
  "phone": "+251911000001",
  "password": "secure_password",
  "setup_key": "ERCA_SUPER_ADMIN_SETUP_2025"
}
```

**Response:**
```json
{
  "success": true,
  "message": "ERCA Super Admin created successfully",
  "official_id": 1
}
```

**Notes:**
- Can only be executed once
- Requires correct setup_key
- First official becomes super admin with Commissioner General rank

#### 2. Login
**Endpoint:** `POST /api/erca/auth/login`

**Request:**
```json
{
  "employee_id": "ERCA001",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "session_token": "abc123...",
  "expires_at": "2025-11-23T10:00:00Z",
  "official": {
    "id": 1,
    "full_name": "Commissioner General",
    "employee_id": "ERCA001",
    "email": "cg@erca.gov.et",
    "rank": "cg",
    "rank_name": "Commissioner General",
    "rank_level": 1,
    "department": "Administration",
    "region": null,
    "is_super_admin": 1,
    "permissions": {
      "can_manage_users": 1,
      "can_audit_businesses": 1,
      "can_verify_invoices": 1,
      "can_generate_reports": 1,
      "can_configure_system": 1
    }
  }
}
```

#### 3. Validate Session
**Endpoint:** `POST /api/erca/auth/validate`

**Request:**
```json
{
  "session_token": "abc123..."
}
```

**Response:**
```json
{
  "valid": true,
  "official": {
    "id": 1,
    "full_name": "Commissioner General",
    "employee_id": "ERCA001",
    "rank": "cg",
    "is_super_admin": 1
  }
}
```

#### 4. Logout
**Endpoint:** `POST /api/erca/auth/logout`

**Request:**
```json
{
  "session_token": "abc123..."
}
```

**Response:**
```json
{
  "success": true
}
```

### User Management

#### 5. Get All Officials
**Endpoint:** `GET /api/erca/admin/officials`

**Headers:**
```
Authorization: Bearer {session_token}
```

**Response:**
```json
{
  "officials": [
    {
      "id": 1,
      "full_name": "Commissioner General",
      "employee_id": "ERCA001",
      "email": "cg@erca.gov.et",
      "phone": "+251911000001",
      "rank": "cg",
      "rank_name": "Commissioner General",
      "rank_level": 1,
      "department": "Administration",
      "region": null,
      "office_location": null,
      "is_super_admin": 1,
      "is_active": 1,
      "created_at": "2025-11-16T10:00:00Z",
      "last_login_at": "2025-11-16T11:00:00Z"
    }
  ]
}
```

**Permissions Required:** `can_manage_users` or `is_super_admin`

#### 6. Create New Official
**Endpoint:** `POST /api/erca/admin/officials`

**Headers:**
```
Authorization: Bearer {session_token}
```

**Request:**
```json
{
  "full_name": "John Doe",
  "employee_id": "ERCA002",
  "email": "john.doe@erca.gov.et",
  "phone": "+251911000002",
  "password": "optional_password",
  "rank": "dg",
  "department": "Revenue Monitoring",
  "region": "Addis Ababa",
  "office_location": "Main Office"
}
```

**Response:**
```json
{
  "success": true,
  "official_id": 2,
  "message": "ERCA official created successfully",
  "default_password": "1234"
}
```

**Notes:**
- If no password provided, default is "1234"
- User must change password on first login (feature to be implemented)
- Permissions Required: `can_manage_users` or `is_super_admin`

#### 7. Update Official
**Endpoint:** `PUT /api/erca/admin/officials/:id`

**Headers:**
```
Authorization: Bearer {session_token}
```

**Request:**
```json
{
  "full_name": "Updated Name",
  "email": "new.email@erca.gov.et",
  "phone": "+251911000003",
  "rank": "dcg",
  "department": "Customs Operations",
  "region": "Oromia",
  "office_location": "Regional Office",
  "is_active": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Official updated successfully"
}
```

**Permissions Required:** `can_manage_users` or `is_super_admin`

### Reference Data

#### 8. Get All Ranks
**Endpoint:** `GET /api/erca/admin/ranks`

**Response:**
```json
{
  "ranks": [
    {
      "id": 1,
      "rank_code": "cg",
      "rank_name": "Commissioner General",
      "rank_level": 1,
      "description": "Highest authority - Full system access",
      "can_manage_users": 1,
      "can_audit_businesses": 1,
      "can_verify_invoices": 1,
      "can_generate_reports": 1,
      "can_configure_system": 1
    }
  ]
}
```

#### 9. Get All Departments
**Endpoint:** `GET /api/erca/admin/departments`

**Response:**
```json
{
  "departments": [
    {
      "id": 1,
      "department_name": "Revenue Monitoring",
      "department_code": "REV",
      "description": "Tax revenue collection and monitoring",
      "is_active": 1
    }
  ]
}
```

### Audit Logs

#### 10. Get Audit Logs
**Endpoint:** `GET /api/erca/admin/audit-logs?limit=100`

**Headers:**
```
Authorization: Bearer {session_token}
```

**Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "action": "login",
      "entity_type": null,
      "entity_id": null,
      "details": "{\"method\":\"password\"}",
      "ip_address": null,
      "created_at": "2025-11-16T10:00:00Z",
      "full_name": "Commissioner General",
      "employee_id": "ERCA001",
      "rank": "cg"
    }
  ]
}
```

**Permissions Required:** `is_super_admin` only

**Action Types:**
- `login` - Official logged in
- `logout` - Official logged out
- `create_user` - New official created
- `update_user` - Official updated
- `view_business` - Business data viewed
- `verify_invoice` - Invoice verified
- `generate_report` - Report generated

## Initial Setup Guide

### Step 1: Deploy to Production

```bash
# From the fredo-erca-hub directory
npm run build
npx wrangler pages deploy dist --project-name fredo-erca-hub
```

### Step 2: Apply Database Migrations

```bash
# Apply to production database
npx wrangler d1 migrations apply fredo-vpos-production --remote
```

### Step 3: Create Super Admin

```bash
# Using cURL
PASSWORD_HASH=$(echo -n "YourSecurePassword" | openssl dgst -sha256 -hex | cut -d' ' -f2)

curl -X POST https://your-erca-hub.pages.dev/api/erca/admin/setup \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Commissioner General",
    "employee_id": "ERCA001",
    "email": "cg@erca.gov.et",
    "phone": "+251911000001",
    "password": "YourSecurePassword",
    "setup_key": "ERCA_SUPER_ADMIN_SETUP_2025"
  }'
```

### Step 4: Login and Test

```bash
# Login
curl -X POST https://your-erca-hub.pages.dev/api/erca/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "ERCA001",
    "password": "YourSecurePassword"
  }'

# Save the session_token from response

# Get all officials
curl -H "Authorization: Bearer {session_token}" \
  https://your-erca-hub.pages.dev/api/erca/admin/officials
```

## Security Considerations

1. **Setup Key**: Change `ERCA_SUPER_ADMIN_SETUP_2025` to a secure key in production
2. **Password Policy**: Enforce strong passwords (minimum 8 characters, mix of uppercase, lowercase, numbers, symbols)
3. **Session Expiration**: Sessions expire after 7 days
4. **Audit Logging**: All administrative actions are logged
5. **IP Tracking**: Session IP addresses can be logged for security
6. **HTTPS Only**: All API calls must use HTTPS in production
7. **Password Reset**: Implement secure password reset flow (to be added)
8. **Two-Factor Authentication**: Consider adding 2FA for high-level officials (future enhancement)

## Permissions Matrix

| Rank | Manage Users | Audit Business | Verify Invoice | Generate Reports | Configure System |
|------|--------------|----------------|----------------|------------------|------------------|
| CG   | ✅ All       | ✅ All         | ✅             | ✅ All           | ✅               |
| DCG  | ✅ Regional  | ✅ Regional    | ✅             | ✅ Regional      | ✅               |
| DG   | ✅ Dept      | ✅ Dept        | ✅             | ✅ Dept          | ❌               |
| DIR  | ✅ Division  | ✅ Division    | ✅             | ✅ Division      | ❌               |
| DD   | ❌           | ✅ Assigned    | ✅             | ✅ Team          | ❌               |
| TL   | ❌           | ✅ Assigned    | ✅             | ✅ Team          | ❌               |
| SO   | ❌           | ✅ Assigned    | ✅             | ✅ View Only     | ❌               |
| OFF  | ❌           | ❌             | ✅             | ❌               | ❌               |
| AO   | ❌           | ❌             | ✅             | ❌               | ❌               |

## Next Steps

### Frontend Dashboard (To be implemented)
- Login page for ERCA officials
- User management interface
- Role-based navigation
- Audit log viewer
- Business monitoring dashboard
- Invoice verification interface

### Additional Features
- Password reset functionality
- User profile management
- Activity monitoring
- Email notifications
- Mobile app support
- Biometric authentication

---

**Version:** 1.0.0  
**Last Updated:** 2025-11-16  
**Status:** Production Ready (Backend API)
