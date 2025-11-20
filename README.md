# Fredo ERCA Revenue Hub

Ethiopian Revenue and Customs Authority (ERCA) compliance monitoring and reporting dashboard for the Fredo TaxPOS system.

## Project Overview

**Name**: Fredo ERCA Revenue Hub  
**Purpose**: Central tax compliance monitoring dashboard for Ethiopian tax authorities  
**Type**: Government portal with user management, analytics, verification, and compliance monitoring  
**Production URL**: https://f27ca0a1.fredo-erca-hub.pages.dev  
**Integrated with**: Fredo vPOS (https://28df9da6.fredo-vpos.pages.dev)

## Features Status

### ✅ Completed Features (ALL DEPLOYED)

1. **ERCA Official User Management** ⭐ NEW
   - 9-level government hierarchy (CG, DCG, DG, DIR, DD, TL, SO, OFF, AO)
   - Complete CRUD operations for officials
   - Role-based permissions system
   - Session validation and management (24-hour sessions)
   - Secure logout with audit logging
   - Audit logging of all actions
   - Profile management and password change
   - CSV export of officials and audit logs

2. **Invoice Verification Dashboard** ⭐ NEW  
   - Search invoices by invoice number
   - Complete invoice details display
   - Business information (TIN, name, location, region, type)
   - Financial summary (subtotal, VAT, turnover tax, total)
   - Invoice items listing
   - ERCA sync status verification
   - Print functionality for reports
   - Real-time verification against vPOS database

3. **Business Monitoring Dashboard** ⭐ NEW
   - Real-time view of all registered businesses
   - Transaction counts and revenue per business
   - VAT collection tracking
   - Compliance rate calculations
   - Advanced filtering (by name, TIN, city, type, compliance level)
   - Summary statistics (total businesses, revenue, VAT, transactions)
   - CSV export functionality
   - Color-coded compliance indicators

4. **Compliance Report Dashboard** ⭐ NEW
   - Categorized businesses: Compliant (≥95%), Partial (70-94%), Non-Compliant (<70%)
   - Period selection (today, week, month, year)
   - Summary cards with totals and averages
   - Detailed business cards in each category
   - CSV export and print functionality
   - Overall compliance percentage calculation

5. **Tax Revenue Dashboard**
   - Real-time tax collection statistics
   - Active businesses monitoring
   - Total transactions tracking
   - VAT and Turnover Tax collection totals
   - Daily tax collection trends
   - Period filtering (today, week, month, year)

6. **Advanced Analytics Dashboard (Phase 3)**
   - Interactive Ethiopia Map: Regional revenue visualization across all 13 regions
   - Business Type Analysis: Revenue breakdown by restaurant, retail, electronics, etc.
   - Business Size Distribution: Analytics for micro, small, medium, and large enterprises
   - Top Tax Contributors: Ranking of highest-performing businesses
   - Monthly Revenue Trends: Time-series visualization
   - Regional Breakdown: Addis Ababa, Oromia, Amhara, and all regions

### ✅ ERCA-vPOS Integration (COMPLETE)

All integration endpoints are live and working:
- Automatic sale sync from vPOS to ERCA
- Real-time business data retrieval
- Invoice verification API
- Compliance monitoring API
- Tax summary reporting API

### ❌ Not Implemented

- Business-specific drill-down reports
- Historical data comparison
- Alert system for compliance issues
- PDF report generation

## Access URLs

### Production (Cloudflare Pages) - ✅ DEPLOYED
- **Homepage**: https://f27ca0a1.fredo-erca-hub.pages.dev/
- **Login**: https://f27ca0a1.fredo-erca-hub.pages.dev/erca-login
- **Officials Manager**: https://f27ca0a1.fredo-erca-hub.pages.dev/erca-dashboard
- **Analytics Dashboard**: https://f27ca0a1.fredo-erca-hub.pages.dev/analytics
- **Business Details**: https://f27ca0a1.fredo-erca-hub.pages.dev/business-details?tin={TIN}
- **Audit Logs**: https://f27ca0a1.fredo-erca-hub.pages.dev/erca-audit-logs
- **Profile**: https://f27ca0a1.fredo-erca-hub.pages.dev/erca-profile
- **Invoice Verification**: https://f27ca0a1.fredo-erca-hub.pages.dev/verify-invoice
- **Business Monitoring**: https://f27ca0a1.fredo-erca-hub.pages.dev/business-monitoring
- **Compliance Report**: https://f27ca0a1.fredo-erca-hub.pages.dev/compliance-report
- **API Base**: https://f27ca0a1.fredo-erca-hub.pages.dev/api/erca
- **Status**: ✅ Active with full ERCA-vPOS integration operational

### Sandbox Environment
- **Dashboard**: https://3001-icd2jzp8cuk2tyhf9orx5-8f57ffe2.sandbox.novita.ai
- **API Base**: https://3001-icd2jzp8cuk2tyhf9orx5-8f57ffe2.sandbox.novita.ai/api/erca

### Local Development
- **Dashboard**: http://localhost:3001
- **API Base**: http://localhost:3001/api/erca

### Related Applications
- **Fredo vPOS (Business App)**: https://e5b4cb33.fredo-vpos.pages.dev
- **GitHub Repository**: Project files available in sandbox environment

## API Endpoints

### Core Tax Monitoring

#### Tax Summary
```bash
GET /api/erca/tax-summary?period={today|week|month|year}
```

**Response**:
```json
{
  "summary": {
    "active_businesses": 0,
    "total_transactions": 0,
    "total_sales": 0,
    "total_vat_collected": 0,
    "total_turnover_tax_collected": 0,
    "total_tax_collected": 0,
    "total_revenue": 0
  },
  "daily_trend": [
    {
      "date": "2024-11-14",
      "transactions": 0,
      "tax_collected": 0
    }
  ]
}
```

### Invoice Verification
```bash
GET /api/erca/verify-invoice/{invoiceNumber}
```

**Response**:
```json
{
  "verified": true,
  "invoice": {
    "invoice_number": "INV-001",
    "business_name": "Fredo Coffee Shop",
    "tin": "1234567890",
    "total_amount": 115.0,
    "vat_amount": 15.0,
    "sale_date": "2024-11-01T10:30:00"
  }
}
```

### Business Monitoring

#### List All Businesses
```bash
GET /api/erca/businesses
```

**Response**:
```json
{
  "businesses": [
    {
      "id": 1,
      "tin": "1234567890",
      "business_name": "Addis Coffee House",
      "city": "Addis Ababa",
      "business_type": "restaurant",
      "total_transactions": 0,
      "total_revenue": 0,
      "total_vat_collected": 0
    }
  ]
}
```

#### Business Details by TIN
```bash
GET /api/erca/businesses/{tin}
```

### Advanced Analytics (Phase 3)

#### Regional Revenue Breakdown
```bash
GET /api/erca/analytics/regional-revenue
```

**Response**:
```json
[
  {
    "region": "AA",
    "region_name": "Addis Ababa",
    "num_businesses": 2,
    "num_transactions": 0,
    "total_revenue": 0,
    "total_tax": 0,
    "avg_transaction_value": 0
  }
]
```

#### Business Type Analytics
```bash
GET /api/erca/analytics/business-type-revenue
```

**Response**:
```json
[
  {
    "business_type": "restaurant",
    "category_name": "Restaurant/Café",
    "icon": "fa-utensils",
    "num_businesses": 2,
    "total_revenue": 0,
    "total_tax": 0
  }
]
```

#### Business Size Distribution
```bash
GET /api/erca/analytics/business-size-revenue
```

**Response**:
```json
[
  {
    "business_size": "small",
    "size_name": "Small (500K-2M ETB)",
    "num_businesses": 1,
    "total_revenue": 0
  }
]
```

#### Top Tax Contributors
```bash
GET /api/erca/analytics/top-taxpayers?limit=20
```

#### Sector Breakdown
```bash
GET /api/erca/analytics/sector-breakdown
```

#### Monthly Trends
```bash
GET /api/erca/analytics/monthly-trends
```

### Compliance & Verification

#### Sync Status
```bash
GET /api/erca/compliance/sync-status
```

#### Tax Filings
```bash
GET /api/erca/reports/tax-filings?status={draft|filed|paid|overdue}
```

### Health Check
```bash
GET /api/health
```

**Response**:
```json
{
  "status": "ok",
  "app": "Fredo ERCA Hub",
  "message": "Government Revenue Hub API is running",
  "timestamp": "2025-11-15T12:00:00Z"
}
```

## Data Architecture

### Storage Services
- **Cloudflare D1**: SQLite-based distributed database (shared with vPOS)
- **Database Name**: `fredo-vpos-production` (production) / `fredo-taxpos-db` (legacy local)
- **Database ID**: `5ff646b0-b678-46a2-98d0-6187f68c465c`
- **Access Mode**: Read-only for ERCA Hub (monitoring only)
- **Architecture**: Shared database allows real-time system-wide monitoring

### Data Models

#### Sales Table (Read Access)
```sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  business_id INTEGER,
  invoice_number TEXT UNIQUE,
  sale_date DATETIME,
  subtotal REAL,
  vat_amount REAL,
  turnover_tax_amount REAL,
  excise_tax_amount REAL,
  total_amount REAL,
  status TEXT
)
```

#### Businesses Table (Read Access)
```sql
CREATE TABLE businesses (
  id INTEGER PRIMARY KEY,
  business_name TEXT,
  tin TEXT UNIQUE,
  business_type TEXT,
  address TEXT,
  status TEXT
)
```

### Data Flow
```
[vPOS Applications] 
       ↓ (writes)
[Shared D1 Database: fredo-taxpos-db]
       ↓ (reads)
[ERCA Hub Dashboard]
```

## Tech Stack

- **Backend**: Hono (lightweight web framework)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JavaScript
- **Styling**: Tailwind CSS (CDN)
- **Charts**: Chart.js (CDN)
- **HTTP Client**: Axios (CDN)
- **Build Tool**: Vite
- **Deployment**: Cloudflare Pages

## Local Development Setup

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/RoboCOVA/Fredo-ERCA-Hub.git
cd Fredo-ERCA-Hub
```

2. **Install dependencies**:
```bash
npm install
```

3. **Initialize database**:
```bash
# Apply migrations
npm run db:migrate:local

# Seed test data
npm run db:seed
```

4. **Build the project**:
```bash
npm run build
```

5. **Start development server**:
```bash
# Using PM2 (recommended for sandbox)
pm2 start ecosystem.config.cjs

# Or directly
npm run dev:sandbox
```

6. **Access the application**:
   - Dashboard: http://localhost:3001
   - API: http://localhost:3001/api

### Development Commands

```bash
# Build project
npm run build

# Start dev server (sandbox mode)
npm run dev:sandbox

# Database operations
npm run db:migrate:local    # Apply migrations
npm run db:seed            # Seed test data
npm run db:reset           # Reset and reseed database

# Clean port 3001
npm run clean-port

# Test API
npm test

# Check PM2 logs
pm2 logs fredo-erca-hub --nostream
```

## Project Structure

```
fredo-erca-hub/
├── src/
│   └── index.tsx              # Main Hono application
├── public/
│   └── static/
│       └── erca.js            # Frontend dashboard logic
├── migrations/
│   └── 0001_initial_schema.sql
├── seed.sql                   # Test data
├── dist/                      # Build output
├── .wrangler/                 # Local D1 database
├── ecosystem.config.cjs       # PM2 configuration
├── wrangler.jsonc            # Cloudflare configuration
├── vite.config.ts            # Vite build config
├── package.json
└── README.md
```

## Database Notes

### Local Development Database

When using `--local` mode, ERCA Hub creates its own separate local D1 database:
- Location: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`
- Database file: `[hash].sqlite`

**Important**: This is separate from the vPOS local database. Both applications need:
1. Same migration files
2. Migrations applied separately
3. Data synced if needed

### Production Database

In production, both vPOS and ERCA Hub share the same D1 database:
- vPOS: Read/Write access
- ERCA Hub: Read-only access (by design)

## Deployment

### Cloudflare Pages Deployment

1. **Prerequisites**:
   - Cloudflare account
   - Wrangler CLI configured
   - D1 database created

2. **Create D1 database** (if not exists):
```bash
npx wrangler d1 create fredo-taxpos-db
# Copy the database_id to wrangler.jsonc
```

3. **Apply migrations to production**:
```bash
npm run db:migrate:prod
```

4. **Build and deploy**:
```bash
npm run deploy
```

5. **Configure environment**:
   - Update `wrangler.jsonc` with production database ID
   - Verify D1 binding configuration

## Recent Updates

### Homepage Business Links (November 18, 2025)

**Feature**: Made business list clickable on homepage with direct links to business details

**Implementation**:
- Added "Actions" column to homepage business table
- Made business names clickable blue links
- Added "View" button for each business row
- Both business name and View button route to business details page
- Updated table colspan to accommodate new Actions column

**User Flow**:
- Homepage → Click business name OR View button → Business Details
- Consistent behavior across all pages (Homepage, Analytics, Business Monitoring)

**Benefits**:
- Users can access business details from any page
- Homepage now fully integrated with business details navigation
- Consistent user experience throughout the portal

**Status**: ✅ Deployed to production

### Business Details Page Integration (November 18, 2025)

**Feature**: Full integration of Business Details page with clickable business links

**Implementation**:
- Updated Business Details page navigation to match ERCA portal purple theme
- Added consistent navigation: Analytics, Officials, Businesses links
- Made business names clickable in Analytics Dashboard (Top Tax Contributors)
- Business Monitoring page already had "View" button functionality
- All business links route to `/business-details?tin={TIN}`

**User Flow**:
1. Analytics Dashboard → Click business name → Business Details
2. Business Monitoring → Click "View" button → Business Details
3. Business Details → Full profile with tabs, statistics, and transaction history

**Benefits**:
- Seamless navigation from analytics to individual business details
- Consistent user experience across all business-related pages
- Easy drill-down from aggregate data to individual business profiles

**Status**: ✅ Deployed to production

### Navigation Integration (November 18, 2025)

**Feature**: Connected Officials Manager and Analytics Dashboard with cross-navigation

**Implementation**:
- Added "Analytics" link to Officials Manager navigation bar
- Added "Officials" link to Analytics Dashboard navigation bar
- Updated Audit Logs and Profile pages with both links
- All ERCA portal pages now have consistent navigation
- Users can seamlessly switch between management and analytics views

**Benefits**:
- Improved user experience with easy access to all portal features
- Super admins can quickly navigate between officials management and analytics
- Consistent navigation structure across all pages

**Status**: ✅ Deployed to production

## Recent Fixes

### Rank Field Made Optional (November 20, 2025)

**Issue**: Rank dropdown was empty and required field was blocking official creation

**Root Cause**: 
- Backend was querying `erca_ranks` table which doesn't exist in production
- Rank field was marked as required with asterisk
- Officials couldn't be created without selecting a rank from empty dropdown

**Solution**:
- Changed Rank field from required dropdown to optional text input
- Removed dependency on `erca_ranks` table
- Frontend now accepts free-text rank input (e.g., "Senior Officer", "Inspector")
- Backend uses default value "Official" if rank is not provided
- Updated field label from "Rank *" to "Rank" (removed asterisk)
- Frontend sends `rank_name` field with default "Official" value if empty

**Status**: ✅ Fixed - officials can now be created with custom or no rank

### Missing Departments Dropdown Fix (November 20, 2025)

**Issue**: Department dropdown in "Add New ERCA Official" form was empty

**Root Cause**: 
- Production database was missing the `erca_departments` table
- Backend `/api/erca/admin/departments` endpoint returned empty results
- Frontend dropdown showed "Select Department" with no options

**Solution**:
- Created migration `0006_add_departments.sql` with departments table schema
- Applied migration directly to production database bypassing migration conflicts
- Added 8 default Ethiopian government departments:
  - Revenue Monitoring (REV)
  - Customs Operations (CUST)
  - Audit and Investigation (AUDIT)
  - Compliance and Enforcement (COMP)
  - Information Technology (IT)
  - Legal Affairs (LEGAL)
  - Human Resources (HR)
  - Finance and Administration (FIN)

**Status**: ✅ Fixed - departments now available in production

### Audit Logs Database Column Fix (November 20, 2025)

**Issue**: Audit Logs page showed "error loading audit logs"

**Root Cause**: 
- Backend query tried to select `o.rank` column from `erca_officials` table
- The actual column name is `rank_name` (not `rank`)
- SQL query failed causing 500 error on `/api/erca/admin/audit-logs` endpoint

**Solution**:
- Updated audit logs query to use `o.rank_name as rank`
- Query now correctly aliases `rank_name` column to `rank` for frontend compatibility
- Frontend JavaScript expects `rank` field in response

**Status**: ✅ Fixed and deployed to production (https://f27ca0a1.fredo-erca-hub.pages.dev)

### Database Schema Alignment Fix (November 18, 2025)

**Issue**: ERCA Officials Manager showed "error loading officials"

**Root Cause**: 
- Code tried to JOIN with `erca_ranks` table which doesn't exist
- Used wrong column names (`rank` instead of `rank_name`, included non-existent `region`)
- Wrong audit table name (`erca_audit_log` instead of `erca_audit_logs`)
- Typo in audit table name (`erca_audit_logss`)

**Solution**:
- Removed all `erca_ranks` table JOINs
- Updated column names to match actual schema
- Fixed audit table name consistently
- Updated permission checks to use direct columns
- Applied migration to fredo-erca-hub local database

**Status**: ✅ Fixed and deployed to production

### Permission Mismatch Fix (November 18, 2025)

**Issue**: ERCA001 user couldn't access ERCA Officials Manager page despite being super admin

**Root Cause**: 
- Frontend checked for `can_manage_users` permission
- Backend returned `manage_officials` permission
- Permission name mismatch caused access denial

**Solution**:
- Added `can_manage_users` as alias to `manage_officials` in permissions object
- Both permission names now work for Officials Manager access
- All super admin permissions now properly recognized

**Status**: ✅ Fixed and deployed to production

### Auto-Logout Issue Fix (November 18, 2025)

**Issue**: Officials successfully logged in but were immediately logged out automatically

**Root Cause**: 
- Frontend `validateSession()` function called `/api/erca/auth/validate` endpoint which didn't exist
- Validation failure triggered `clearSession()` and redirect to login

**Solution**:
1. Added `/api/erca/auth/validate` endpoint with full session validation
   - Checks session token existence in database
   - Validates session is not expired (24-hour check)
   - Verifies official account is active and not locked
   - Updates last_activity timestamp
2. Added `/api/erca/auth/logout` endpoint for clean logout
   - Removes session from database
   - Logs logout action in audit_logs

**Status**: ✅ Fixed and deployed to production

### Dashboard Error Fix (November 14, 2025)

**Issue**: Dashboard displayed "error loading dashboard data"

**Root Causes**:
1. SQL queries didn't handle NULL values properly
2. Local database wasn't initialized

**Solution**:
1. Added COALESCE() to all SUM() operations
2. Applied migrations to local database
3. Seeded test data

**Status**: ✅ Fixed

See [ERCA_HUB_FIX.md](../ERCA_HUB_FIX.md) for detailed fix documentation.

## Testing

### Manual Testing

1. **Dashboard Load**: Visit http://localhost:3001
2. **Tax Summary**: Check summary cards display
3. **Period Filter**: Test today/week/month/year filters
4. **Invoice Verification**: Enter invoice number or scan QR code

### API Testing

```bash
# Health check
curl http://localhost:3001/api/health

# Tax summary
curl "http://localhost:3001/api/erca/tax-summary?period=month"

# Invoice verification
curl "http://localhost:3001/api/erca/verify-invoice/INV-001"
```

## Known Issues

1. **Zero Data Display**: 
   - Seed data uses old dates
   - Current date filters return no results
   - **Workaround**: Create new sales through vPOS with current dates

2. **Database Sync**:
   - Local databases not automatically synced between vPOS and ERCA Hub
   - **Workaround**: Apply migrations and seed data to both projects

## Related Projects

- **Fredo vPOS**: https://github.com/RoboCOVA/Fredo-vPOS (Main POS application)
- **Original Monolithic App**: Fredo TaxPOS (deprecated)

## Ethiopian Tax Compliance

This application supports Ethiopian tax regulations:
- **VAT Rate**: 15%
- **Turnover Tax**: 2% (for businesses below VAT threshold)
- **ERCA Compliance**: Invoice verification and tax reporting

## License

MIT License

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/RoboCOVA/Fredo-ERCA-Hub/issues
- Documentation: See [TESTING_GUIDE.md](../TESTING_GUIDE.md)

---

## Production Deployment Status

**Version**: 2.3.0 (Homepage Business Links Complete)  
**Last Updated**: November 18, 2025  
**Status**: ✅ Fully Operational in Production  
**Deployment**: Production (Cloudflare Pages) + Sandbox + Local Development  
**Latest Deployment**: https://51657682.fredo-erca-hub.pages.dev

### Production Metrics (as of deployment):
- **Total Businesses**: 7 registered businesses
- **Regional Coverage**: 3 regions (Addis Ababa, Oromia, Amhara)
- **Business Types**: Restaurants (2), Electronics (2), Retail (3)
- **Business Sizes**: Small (1), Medium (1), Large (1), Others (4)
- **Database**: Shared `fredo-vpos-production` D1 database
- **Analytics**: Real-time regional, type, and size-based monitoring active

### Phase 3 Achievements:
✅ **Interactive Ethiopia Map** - All 13 regions visualized with revenue data  
✅ **Business Classification** - 9 types × 4 sizes = 36 analytics segments  
✅ **Regional Analytics** - Real-time monitoring across Ethiopian administrative divisions  
✅ **Top Performers** - Ranked tax contributor leaderboards  
✅ **Shared Database** - Seamless data flow from vPOS to ERCA Hub in production  
✅ **Production Tested** - 3 test businesses created via onboarding wizard in production
