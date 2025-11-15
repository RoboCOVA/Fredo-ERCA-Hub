# Fredo ERCA Revenue Hub

Ethiopian Revenue and Customs Authority (ERCA) compliance monitoring and reporting dashboard for the Fredo TaxPOS system.

## Project Overview

**Name**: Fredo ERCA Revenue Hub  
**Purpose**: Central tax compliance monitoring dashboard for Ethiopian tax authorities  
**Type**: Read-only analytics and verification dashboard

## Features Status

### ✅ Completed Features

1. **Tax Revenue Dashboard**
   - Real-time tax collection statistics
   - Active businesses monitoring
   - Total transactions tracking
   - VAT and Turnover Tax collection totals
   - Daily tax collection trends
   - Period filtering (today, week, month, year)

2. **Invoice Verification**
   - QR code scanning for invoice verification
   - Invoice authenticity checking
   - Business details lookup
   - Sale transaction validation

3. **Business Compliance Monitoring**
   - Active businesses count
   - Transaction volume tracking
   - Tax compliance overview

4. **Data Visualization**
   - Tax collection trends chart
   - Summary statistics cards
   - Period comparison metrics

5. **Advanced Analytics Dashboard (Phase 3)**
   - **Interactive Ethiopia Map**: Regional revenue visualization across all 13 regions
   - **Business Type Analysis**: Revenue breakdown by restaurant, retail, electronics, etc.
   - **Business Size Distribution**: Analytics for micro, small, medium, and large enterprises
   - **Top Tax Contributors**: Ranking of highest-performing businesses
   - **Monthly Revenue Trends**: Time-series visualization
   - **Regional Breakdown**: Addis Ababa, Oromia, Amhara, and all regions

### 🔄 In Progress

- Real-time data updates
- Export functionality (PDF/Excel reports)

### ❌ Not Implemented

- Business-specific drill-down reports
- Historical data comparison
- Alert system for compliance issues
- PDF report generation

## Access URLs

### Production (Cloudflare Pages) - ✅ DEPLOYED
- **Dashboard**: https://27aea385.fredo-erca-hub.pages.dev
- **Production Branch**: https://main.fredo-erca-hub.pages.dev
- **API Base**: https://27aea385.fredo-erca-hub.pages.dev/api/erca
- **Status**: ✅ Active with 7 registered businesses across 3 regions

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

## Recent Fixes

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

**Version**: 2.0.0 (Phase 3 Complete)  
**Last Updated**: November 15, 2025  
**Status**: ✅ Fully Operational in Production  
**Deployment**: Production (Cloudflare Pages) + Sandbox + Local Development

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
