import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// Type definitions for Cloudflare bindings
type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for all API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ============================================
// API ROUTES
// ============================================

app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    app: 'Fredo ERCA Hub',
    message: 'Government Revenue Hub API is running',
    timestamp: new Date().toISOString()
  })
})

// ============================================
// ERCA AUTHENTICATION (Government Officials)
// ============================================

app.post('/api/erca/auth/login', async (c) => {
  const { DB } = c.env
  const { username, password } = await c.req.json()
  
  try {
    // In production, implement proper government authentication
    // For now, use a simple check
    if (username === 'erca_admin' && password === 'erca2024') {
      return c.json({ 
        success: true,
        user: {
          id: 100,
          username: 'erca_admin',
          role: 'erca_official',
          department: 'Revenue Monitoring'
        }
      })
    }
    
    return c.json({ error: 'Invalid credentials' }, 401)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ============================================
// BUSINESS MONITORING ROUTES
// ============================================

app.get('/api/erca/businesses', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT 
        b.id,
        b.tin,
        b.business_name,
        b.city,
        b.business_type,
        COUNT(s.id) as total_transactions,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.vat_amount), 0) as total_vat_collected,
        COALESCE(SUM(s.turnover_tax_amount), 0) as total_turnover_tax_collected
      FROM businesses b
      LEFT JOIN sales s ON b.id = s.business_id AND s.status = 'completed'
      GROUP BY b.id
      ORDER BY total_revenue DESC
    `).all()
    
    return c.json({ businesses: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/erca/businesses/:tin', async (c) => {
  const { DB } = c.env
  const tin = c.req.param('tin')
  
  try {
    const business = await DB.prepare(`
      SELECT 
        b.*,
        COUNT(s.id) as total_transactions,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.vat_amount), 0) as total_vat_collected
      FROM businesses b
      LEFT JOIN sales s ON b.id = s.business_id
      WHERE b.tin = ?
      GROUP BY b.id
    `).bind(tin).first()
    
    if (!business) {
      return c.json({ error: 'Business not found' }, 404)
    }
    
    return c.json(business)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ============================================
// TAX COLLECTION MONITORING
// ============================================

app.get('/api/erca/tax-summary', async (c) => {
  const { DB } = c.env
  const period = c.req.query('period') || 'month'
  
  try {
    let dateFilter = ''
    
    switch (period) {
      case 'today':
        dateFilter = "WHERE DATE(sale_date) = DATE('now', 'localtime')"
        break
      case 'week':
        dateFilter = "WHERE sale_date >= DATE('now', 'localtime', '-7 days')"
        break
      case 'month':
        dateFilter = "WHERE sale_date >= DATE('now', 'localtime', 'start of month')"
        break
      case 'year':
        dateFilter = "WHERE sale_date >= DATE('now', 'localtime', 'start of year')"
        break
      default:
        dateFilter = "WHERE sale_date >= DATE('now', 'localtime', 'start of month')"
    }
    
    const summary = await DB.prepare(`
      SELECT 
        COUNT(DISTINCT business_id) as active_businesses,
        COUNT(*) as total_transactions,
        COALESCE(SUM(subtotal), 0) as total_sales,
        COALESCE(SUM(vat_amount), 0) as total_vat_collected,
        COALESCE(SUM(turnover_tax_amount), 0) as total_turnover_tax_collected,
        COALESCE(SUM(COALESCE(vat_amount, 0) + COALESCE(turnover_tax_amount, 0) + COALESCE(excise_tax_amount, 0)), 0) as total_tax_collected,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM sales
      ${dateFilter} AND status = 'completed'
    `).first()
    
    const { results: dailyTrend } = await DB.prepare(`
      SELECT 
        DATE(sale_date) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(COALESCE(vat_amount, 0) + COALESCE(turnover_tax_amount, 0) + COALESCE(excise_tax_amount, 0)), 0) as tax_collected
      FROM sales
      ${dateFilter} AND status = 'completed'
      GROUP BY DATE(sale_date)
      ORDER BY date DESC
      LIMIT 30
    `).all()
    
    return c.json({
      summary,
      daily_trend: dailyTrend
    })
  } catch (error: any) {
    console.error('Error in /api/erca/tax-summary:', error)
    return c.json({ error: error.message }, 500)
  }
})

// ============================================
// INVOICE VERIFICATION
// ============================================

app.get('/api/erca/verify-invoice/:invoiceNumber', async (c) => {
  const { DB } = c.env
  const invoiceNumber = c.req.param('invoiceNumber')
  
  try {
    const sale = await DB.prepare(`
      SELECT s.*, b.business_name, b.tin
      FROM sales s
      JOIN businesses b ON s.business_id = b.id
      WHERE s.invoice_number = ? OR s.qr_code = ?
    `).bind(invoiceNumber, invoiceNumber).first()
    
    if (!sale) {
      return c.json({ 
        verified: false,
        message: 'Invoice not found'
      }, 404)
    }
    
    const { results: items } = await DB.prepare(
      'SELECT * FROM sale_items WHERE sale_id = ?'
    ).bind(sale.id).all()
    
    return c.json({
      verified: true,
      sale,
      items
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ============================================
// COMPLIANCE REPORTS
// ============================================

app.get('/api/erca/compliance/sync-status', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT 
        b.business_name,
        b.tin,
        COUNT(s.id) as total_sales,
        SUM(CASE WHEN s.erca_sync_status = 'pending' THEN 1 ELSE 0 END) as pending_sync,
        SUM(CASE WHEN s.erca_sync_status = 'synced' THEN 1 ELSE 0 END) as synced,
        SUM(CASE WHEN s.erca_sync_status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM businesses b
      LEFT JOIN sales s ON b.id = s.business_id
      GROUP BY b.id
      HAVING total_sales > 0
    `).all()
    
    return c.json({ businesses: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/erca/reports/tax-filings', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status') || 'all'
  
  try {
    let whereClause = ''
    if (status !== 'all') {
      whereClause = `WHERE filing_status = '${status}'`
    }
    
    const { results } = await DB.prepare(`
      SELECT 
        tf.*,
        b.business_name,
        b.tin
      FROM tax_filings tf
      JOIN businesses b ON tf.business_id = b.id
      ${whereClause}
      ORDER BY tf.created_at DESC
      LIMIT 100
    `).all()
    
    return c.json({ filings: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ============================================
// ANALYTICS & INSIGHTS
// ============================================

app.get('/api/erca/analytics/sector-breakdown', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT 
        b.business_type,
        COUNT(DISTINCT b.id) as business_count,
        SUM(s.total_amount) as total_revenue,
        SUM(s.vat_amount + s.turnover_tax_amount) as total_tax
      FROM businesses b
      LEFT JOIN sales s ON b.id = s.business_id AND s.status = 'completed'
      GROUP BY b.business_type
      ORDER BY total_revenue DESC
    `).all()
    
    return c.json({ sectors: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/erca/analytics/top-taxpayers', async (c) => {
  const { DB } = c.env
  const limit = parseInt(c.req.query('limit') || '20')
  
  try {
    const { results } = await DB.prepare(`
      SELECT 
        b.business_name,
        b.tin,
        b.city,
        SUM(s.vat_amount + s.turnover_tax_amount + s.excise_tax_amount) as total_tax_collected,
        COUNT(s.id) as transaction_count
      FROM businesses b
      JOIN sales s ON b.id = s.business_id
      WHERE s.status = 'completed'
      GROUP BY b.id
      ORDER BY total_tax_collected DESC
      LIMIT ?
    `).bind(limit).all()
    
    return c.json({ taxpayers: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get regional revenue summary (using SQL views from fredo-vpos)
app.get('/api/erca/analytics/regional-revenue', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT * FROM v_regional_revenue ORDER BY total_revenue DESC
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    console.error('Regional revenue error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Get business type revenue summary
app.get('/api/erca/analytics/business-type-revenue', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT * FROM v_business_type_revenue ORDER BY total_revenue DESC
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get business size revenue summary
app.get('/api/erca/analytics/business-size-revenue', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT * FROM v_business_size_revenue ORDER BY 
        CASE business_size 
          WHEN 'micro' THEN 1 
          WHEN 'small' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'large' THEN 4 
        END
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get monthly revenue trends
app.get('/api/erca/analytics/monthly-trends', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT 
        strftime('%Y-%m', sale_date) as month,
        SUM(total_amount) as total_revenue,
        SUM(vat_amount + turnover_tax_amount + excise_tax_amount) as total_tax,
        COUNT(*) as transaction_count
      FROM sales
      WHERE status = 'completed'
      GROUP BY month
      ORDER BY month ASC
    `).all()
    
    return c.json(results)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ============================================
// FRONTEND ROUTES
// ============================================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ERCA Revenue Hub - Fredo TaxPOS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-100">
        <nav class="bg-purple-700 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <span class="text-xl font-bold">Ethiopian Revenue and Customs Authority</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/analytics" class="bg-purple-800 hover:bg-purple-600 px-4 py-2 rounded transition">
                            <i class="fas fa-chart-line mr-2"></i>Analytics
                        </a>
                        <select id="period-select" class="bg-purple-800 border-0 rounded px-3 py-1" onchange="loadERCADashboard()">
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month" selected>This Month</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 py-6">
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-gray-900">National Revenue Hub Dashboard</h1>
                <p class="text-gray-600">Real-time monitoring of tax collection and business compliance</p>
            </div>

            <!-- National Summary Cards -->
            <div class="grid md:grid-cols-4 gap-6 mb-6">
                <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-lg shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-purple-100 text-sm">Active Businesses</p>
                            <p class="text-3xl font-bold" id="active-businesses">0</p>
                        </div>
                        <i class="fas fa-building text-5xl text-purple-300"></i>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-lg shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-green-100 text-sm">Total Tax Collected</p>
                            <p class="text-3xl font-bold" id="total-tax">0 ETB</p>
                        </div>
                        <i class="fas fa-coins text-5xl text-green-300"></i>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-blue-100 text-sm">Total Transactions</p>
                            <p class="text-3xl font-bold" id="total-trans">0</p>
                        </div>
                        <i class="fas fa-exchange-alt text-5xl text-blue-300"></i>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-lg shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-orange-100 text-sm">Total Revenue</p>
                            <p class="text-3xl font-bold" id="total-revenue-erca">0 ETB</p>
                        </div>
                        <i class="fas fa-chart-line text-5xl text-orange-300"></i>
                    </div>
                </div>
            </div>

            <!-- Tax Collection Trend -->
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h3 class="text-lg font-bold mb-4">Daily Tax Collection Trend</h3>
                <canvas id="tax-trend-chart"></canvas>
            </div>

            <!-- Invoice Verification -->
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h3 class="text-lg font-bold mb-4">
                    <i class="fas fa-qrcode mr-2 text-purple-600"></i>
                    Invoice Verification
                </h3>
                <div class="flex space-x-4">
                    <input type="text" id="invoice-search" placeholder="Enter Invoice Number or QR Code..." 
                           class="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <button onclick="verifyInvoice()" 
                            class="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 transition">
                        <i class="fas fa-search mr-2"></i>
                        Verify
                    </button>
                </div>
                <div id="verification-result" class="mt-4"></div>
            </div>

            <!-- Registered Businesses Table -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-lg font-bold mb-4">Registered Businesses</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TIN</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VAT Collected</th>
                            </tr>
                        </thead>
                        <tbody id="businesses-table" class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td colspan="7" class="px-6 py-4 text-center text-gray-500">Loading businesses...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="/static/erca.js"></script>
    </body>
    </html>
  `)
})

// ============================================
// COMPREHENSIVE ANALYTICS DASHBOARD
// ============================================

app.get('/analytics', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ERCA Analytics Dashboard - National Revenue Monitoring</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-100">
        <!-- Navigation -->
        <nav class="bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-2xl">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-3xl mr-3"></i>
                        <div>
                            <span class="text-xl font-bold">Ethiopian Revenue and Customs Authority</span>
                            <p class="text-xs text-purple-200">National Analytics Dashboard</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="bg-purple-800 hover:bg-purple-600 px-4 py-2 rounded transition">
                            <i class="fas fa-home mr-2"></i>Home
                        </a>
                        <button onclick="exportReport()" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition">
                            <i class="fas fa-file-excel mr-2"></i>Export Report
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 py-6">
            <!-- Page Header -->
            <div class="mb-8">
                <h1 class="text-4xl font-extrabold text-gray-900 mb-2">
                    <i class="fas fa-chart-line text-purple-600 mr-3"></i>
                    Comprehensive Tax Analytics
                </h1>
                <p class="text-gray-600 text-lg">Real-time monitoring of revenue collection across all Ethiopian regions and business sectors</p>
            </div>

            <!-- Summary Cards -->
            <div class="grid md:grid-cols-4 gap-6 mb-8">
                <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-xl shadow-2xl p-6 transform hover:scale-105 transition">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-purple-100 text-sm font-medium">Total Revenue</p>
                            <p class="text-3xl font-bold" id="total-revenue">Loading...</p>
                            <p class="text-xs text-purple-200 mt-1" id="tax-rate">Calculating...</p>
                        </div>
                        <i class="fas fa-coins text-6xl text-purple-300 opacity-50"></i>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-xl shadow-2xl p-6 transform hover:scale-105 transition">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-green-100 text-sm font-medium">Tax Collected</p>
                            <p class="text-3xl font-bold" id="total-tax">Loading...</p>
                            <p class="text-xs text-green-200 mt-1">All tax types combined</p>
                        </div>
                        <i class="fas fa-dollar-sign text-6xl text-green-300 opacity-50"></i>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl shadow-2xl p-6 transform hover:scale-105 transition">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-blue-100 text-sm font-medium">Active Businesses</p>
                            <p class="text-3xl font-bold" id="active-businesses">Loading...</p>
                            <p class="text-xs text-blue-200 mt-1">Registered in system</p>
                        </div>
                        <i class="fas fa-building text-6xl text-blue-300 opacity-50"></i>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-xl shadow-2xl p-6 transform hover:scale-105 transition">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-orange-100 text-sm font-medium">Total Transactions</p>
                            <p class="text-3xl font-bold" id="total-transactions">Loading...</p>
                            <p class="text-xs text-orange-200 mt-1" id="compliance-rate">Checking sync status...</p>
                        </div>
                        <i class="fas fa-exchange-alt text-6xl text-orange-300 opacity-50"></i>
                    </div>
                </div>
            </div>

            <!-- Regional Revenue Heat Map -->
            <div class="bg-white rounded-xl shadow-2xl p-6 mb-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-6">
                    <i class="fas fa-map-marked-alt text-purple-600 mr-2"></i>
                    Regional Revenue Analysis
                </h2>
                
                <!-- Interactive Ethiopia Map -->
                <div id="ethiopia-interactive-map" class="mb-6"></div>
                
                <!-- Regional Heat Map Grid -->
                <div id="regional-list" class="mt-6">
                    <p class="text-gray-500 text-center py-8">Loading regional data...</p>
                </div>
            </div>

            <!-- Business Analytics Charts -->
            <div class="grid md:grid-cols-2 gap-6 mb-8">
                <!-- Business Type Revenue Distribution -->
                <div class="bg-white rounded-xl shadow-2xl p-6">
                    <h3 class="text-xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-store text-purple-600 mr-2"></i>
                        Revenue by Business Type
                    </h3>
                    <canvas id="business-type-chart"></canvas>
                </div>

                <!-- Business Size Analysis -->
                <div class="bg-white rounded-xl shadow-2xl p-6">
                    <h3 class="text-xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-chart-bar text-purple-600 mr-2"></i>
                        Revenue by Business Size
                    </h3>
                    <canvas id="business-size-chart"></canvas>
                </div>
            </div>

            <!-- Revenue Trends -->
            <div class="bg-white rounded-xl shadow-2xl p-6 mb-8">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-chart-line text-purple-600 mr-2"></i>
                    Monthly Revenue & Tax Collection Trends
                </h3>
                <canvas id="revenue-trend-chart"></canvas>
            </div>

            <!-- Top Performing Businesses -->
            <div class="bg-white rounded-xl shadow-2xl p-6 mb-8">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-trophy text-yellow-500 mr-2"></i>
                    Top Tax Contributors
                </h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-purple-50">
                            <tr>
                                <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Rank</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Business</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Type</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Location</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Transactions</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Tax Collected</th>
                            </tr>
                        </thead>
                        <tbody id="top-businesses" class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td colspan="6" class="px-6 py-4 text-center text-gray-500">Loading top taxpayers...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Compliance Monitoring -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-2xl p-6 border-2 border-purple-200">
                <h3 class="text-xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-shield-alt text-purple-600 mr-2"></i>
                    ERCA Sync Compliance Status
                </h3>
                <div id="compliance-alerts" class="space-y-3">
                    <p class="text-gray-500">Loading compliance data...</p>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="bg-purple-900 text-white mt-12 py-6">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <p class="text-purple-200">© 2024 Ethiopian Revenue and Customs Authority</p>
                <p class="text-sm text-purple-300 mt-1">Powered by Fredo vPOS Tax Compliance System</p>
            </div>
        </footer>

        <script src="/static/ethiopia-map.js"></script>
        <script src="/static/erca-hub-analytics.js"></script>
    </body>
    </html>
  `)
})

export default app
