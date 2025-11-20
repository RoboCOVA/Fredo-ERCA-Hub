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
  const { employee_id, password, username } = await c.req.json()
  
  try {
    // Accept either employee_id or username for flexibility
    const loginId = employee_id || username
    
    if (!loginId || !password) {
      return c.json({ error: 'Employee ID and password are required' }, 400)
    }
    
    // Hash the provided password using SHA-256
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Query database for official
    const official: any = await DB.prepare(`
      SELECT 
        id,
        employee_id,
        full_name,
        email,
        phone,
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
        failed_login_attempts,
        account_locked
      FROM erca_officials
      WHERE (employee_id = ? OR email = ?) AND password_hash = ?
    `).bind(loginId, loginId, passwordHash).first()
    
    if (!official) {
      // Invalid credentials - could increment failed attempts here
      return c.json({ error: 'Invalid employee ID or password' }, 401)
    }
    
    // Check if account is active
    if (!official.is_active) {
      return c.json({ error: 'Account is inactive. Contact your administrator.' }, 403)
    }
    
    // Check if account is locked
    if (official.account_locked) {
      return c.json({ error: 'Account is locked. Contact your administrator.' }, 403)
    }
    
    // Generate session token
    const sessionToken = `erca_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    
    // Store session in database
    await DB.prepare(`
      INSERT INTO erca_sessions (
        official_id,
        session_token,
        ip_address,
        user_agent,
        expires_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      official.id,
      sessionToken,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown',
      expiresAt
    ).run()
    
    // Update last login
    await DB.prepare(`
      UPDATE erca_officials
      SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0
      WHERE id = ?
    `).bind(official.id).run()
    
    // Log login action
    await DB.prepare(`
      INSERT INTO erca_audit_logs (
        official_id,
        action,
        ip_address,
        user_agent
      ) VALUES (?, 'login', ?, ?)
    `).bind(
      official.id,
      c.req.header('CF-Connecting-IP') || 'unknown',
      c.req.header('User-Agent') || 'unknown'
    ).run()
    
    // Build permissions object
    const permissions = {
      view_businesses: official.can_view_businesses,
      view_transactions: official.can_view_transactions,
      view_reports: official.can_view_reports,
      manage_officials: official.can_manage_officials,
      can_manage_users: official.can_manage_officials, // Alias for frontend compatibility
      audit_businesses: official.can_audit_businesses,
      issue_penalties: official.can_issue_penalties
    }
    
    return c.json({ 
      success: true,
      official: {
        id: official.id,
        employee_id: official.employee_id,
        full_name: official.full_name,
        email: official.email,
        phone: official.phone,
        role: 'erca_official',
        department: official.department,
        rank_name: official.rank_name,
        office_location: official.office_location,
        is_super_admin: official.is_super_admin,
        permissions
      },
      session_token: sessionToken,
      expires_at: expiresAt
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Validate session
app.post('/api/erca/auth/validate', async (c) => {
  const { DB } = c.env
  const { session_token } = await c.req.json()
  
  try {
    if (!session_token) {
      return c.json({ valid: false, error: 'No session token provided' }, 400)
    }
    
    // Check if session exists and is not expired
    const session: any = await DB.prepare(`
      SELECT 
        es.official_id,
        es.expires_at,
        eo.is_active,
        eo.account_locked
      FROM erca_sessions es
      JOIN erca_officials eo ON es.official_id = eo.id
      WHERE es.session_token = ?
    `).bind(session_token).first()
    
    if (!session) {
      return c.json({ valid: false, error: 'Invalid session' })
    }
    
    // Check if session is expired
    const now = new Date()
    const expiresAt = new Date(session.expires_at)
    if (expiresAt < now) {
      // Delete expired session
      await DB.prepare(`
        DELETE FROM erca_sessions WHERE session_token = ?
      `).bind(session_token).run()
      
      return c.json({ valid: false, error: 'Session expired' })
    }
    
    // Check if account is active
    if (!session.is_active) {
      return c.json({ valid: false, error: 'Account is inactive' })
    }
    
    // Check if account is locked
    if (session.account_locked) {
      return c.json({ valid: false, error: 'Account is locked' })
    }
    
    // Update last activity
    await DB.prepare(`
      UPDATE erca_sessions
      SET last_activity = CURRENT_TIMESTAMP
      WHERE session_token = ?
    `).bind(session_token).run()
    
    return c.json({ valid: true, official_id: session.official_id })
  } catch (error: any) {
    console.error('Session validation error:', error)
    return c.json({ valid: false, error: error.message }, 500)
  }
})

// Logout
app.post('/api/erca/auth/logout', async (c) => {
  const { DB } = c.env
  const { session_token } = await c.req.json()
  
  try {
    if (session_token) {
      // Delete session from database
      await DB.prepare(`
        DELETE FROM erca_sessions WHERE session_token = ?
      `).bind(session_token).run()
      
      // Log logout action
      const session: any = await DB.prepare(`
        SELECT official_id FROM erca_sessions WHERE session_token = ?
      `).bind(session_token).first()
      
      if (session) {
        await DB.prepare(`
          INSERT INTO erca_audit_logs (
            official_id,
            action,
            ip_address,
            user_agent
          ) VALUES (?, 'logout', ?, ?)
        `).bind(
          session.official_id,
          c.req.header('CF-Connecting-IP') || 'unknown',
          c.req.header('User-Agent') || 'unknown'
        ).run()
      }
    }
    
    return c.json({ success: true, message: 'Logged out successfully' })
  } catch (error: any) {
    console.error('Logout error:', error)
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Register new ERCA official (requires super admin)
app.post('/api/erca/auth/register', async (c) => {
  const { DB } = c.env
  const {
    employee_id,
    full_name,
    email,
    phone,
    password,
    department,
    rank_name,
    office_location,
    permissions,
    created_by_token
  } = await c.req.json()
  
  try {
    // Validate required fields
    if (!employee_id || !full_name || !email || !password || !department || !rank_name) {
      return c.json({ error: 'Missing required fields' }, 400)
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400)
    }
    
    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters long' }, 400)
    }
    
    // If created_by_token provided, verify it's from a super admin
    if (created_by_token) {
      const session: any = await DB.prepare(`
        SELECT es.official_id, eo.is_super_admin
        FROM erca_sessions es
        JOIN erca_officials eo ON es.official_id = eo.id
        WHERE es.session_token = ? AND es.expires_at > datetime('now')
      `).bind(created_by_token).first()
      
      if (!session || !session.is_super_admin) {
        return c.json({ error: 'Unauthorized. Only super admins can register officials.' }, 403)
      }
    }
    
    // Check if employee_id or email already exists
    const existing: any = await DB.prepare(`
      SELECT id FROM erca_officials
      WHERE employee_id = ? OR email = ?
    `).bind(employee_id, email).first()
    
    if (existing) {
      return c.json({ error: 'Employee ID or email already exists' }, 400)
    }
    
    // Hash password using SHA-256
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    // Insert new official
    const result = await DB.prepare(`
      INSERT INTO erca_officials (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      employee_id,
      full_name,
      email,
      phone || null,
      passwordHash,
      department,
      rank_name,
      office_location || null,
      permissions?.is_super_admin || 0,
      1, // is_active - default to active
      permissions?.can_view_businesses !== undefined ? permissions.can_view_businesses : 1,
      permissions?.can_view_transactions !== undefined ? permissions.can_view_transactions : 1,
      permissions?.can_view_reports !== undefined ? permissions.can_view_reports : 1,
      permissions?.can_manage_officials || 0,
      permissions?.can_audit_businesses || 0,
      permissions?.can_issue_penalties || 0
    ).run()
    
    const officialId = result.meta.last_row_id
    
    return c.json({
      success: true,
      message: 'Official registered successfully',
      official: {
        id: officialId,
        employee_id,
        full_name,
        email,
        department,
        rank_name
      }
    })
  } catch (error: any) {
    console.error('Registration error:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Get all ERCA officials (super admin only)
app.get('/api/erca/officials', async (c) => {
  const { DB } = c.env
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '')
  
  try {
    // Verify session and super admin
    if (!sessionToken) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    const session: any = await DB.prepare(`
      SELECT es.official_id, eo.is_super_admin
      FROM erca_sessions es
      JOIN erca_officials eo ON es.official_id = eo.id
      WHERE es.session_token = ? AND es.expires_at > datetime('now')
    `).bind(sessionToken).first()
    
    if (!session || !session.is_super_admin) {
      return c.json({ error: 'Unauthorized. Super admin access required.' }, 403)
    }
    
    // Get all officials
    const { results: officials } = await DB.prepare(`
      SELECT 
        id,
        employee_id,
        full_name,
        email,
        phone,
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
        last_login,
        created_at
      FROM erca_officials
      ORDER BY created_at DESC
    `).all()
    
    return c.json({ officials })
  } catch (error: any) {
    console.error('Get officials error:', error)
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
    // Get business info with aggregated transaction data
    const business = await DB.prepare(`
      SELECT 
        b.*,
        COUNT(s.id) as total_transactions,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.vat_amount), 0) as total_vat_collected,
        COALESCE(SUM(s.turnover_tax_amount), 0) as total_turnover_tax_collected,
        COALESCE(SUM(s.excise_tax_amount), 0) as total_excise_tax_collected,
        SUM(CASE WHEN s.erca_sync_status = 'synced' THEN 1 ELSE 0 END) as synced_transactions,
        SUM(CASE WHEN s.erca_sync_status = 'pending' OR s.erca_sync_status IS NULL THEN 1 ELSE 0 END) as pending_transactions
      FROM businesses b
      LEFT JOIN sales s ON b.id = s.business_id AND s.status = 'completed'
      WHERE b.tin = ?
      GROUP BY b.id
    `).bind(tin).first()
    
    if (!business) {
      return c.json({ error: 'Business not found' }, 404)
    }
    
    // Get recent transactions
    const { results: recentTransactions } = await DB.prepare(`
      SELECT 
        id,
        invoice_number,
        sale_date,
        total_amount,
        vat_amount,
        erca_sync_status,
        erca_sync_date
      FROM sales
      WHERE business_id = (SELECT id FROM businesses WHERE tin = ?)
      ORDER BY sale_date DESC
      LIMIT 10
    `).bind(tin).all()
    
    // Get monthly transaction trend (last 6 months)
    const { results: monthlyTrend } = await DB.prepare(`
      SELECT 
        strftime('%Y-%m', sale_date) as month,
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(vat_amount), 0) as vat_collected
      FROM sales
      WHERE business_id = (SELECT id FROM businesses WHERE tin = ?)
        AND sale_date >= DATE('now', '-6 months')
      GROUP BY strftime('%Y-%m', sale_date)
      ORDER BY month DESC
    `).bind(tin).all()
    
    return c.json({
      business,
      recentTransactions,
      monthlyTrend
    })
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
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="businesses-table" class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td colspan="8" class="px-6 py-4 text-center text-gray-500">Loading businesses...</td>
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
                        <a href="/erca-dashboard" class="bg-purple-800 hover:bg-purple-600 px-4 py-2 rounded transition">
                            <i class="fas fa-users-cog mr-2"></i>Officials
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

// ============================================
// ERCA FRONTEND PAGES
// ============================================

// ERCA Login Page
app.get('/erca-login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ERCA Official Login - Ethiopian Revenue Hub</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 min-h-screen flex items-center justify-center p-4">
        <div class="max-w-md w-full">
            <!-- Logo and Header -->
            <div class="text-center mb-8">
                <div class="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
                    <i class="fas fa-landmark text-purple-900 text-3xl"></i>
                </div>
                <h1 class="text-3xl font-bold text-white mb-2">ERCA Official Portal</h1>
                <p class="text-purple-200">Ethiopian Revenue and Customs Authority</p>
            </div>

            <!-- Login Card -->
            <div class="bg-white rounded-2xl shadow-2xl p-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">
                    <i class="fas fa-user-shield text-purple-600 mr-2"></i>
                    Official Login
                </h2>

                <form id="login-form" class="space-y-6">
                    <!-- Employee ID -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-id-card mr-1"></i>
                            Employee ID
                        </label>
                        <input type="text" id="employee-id" required
                               placeholder="e.g., ERCA001"
                               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    </div>

                    <!-- Password -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-lock mr-1"></i>
                            Password
                        </label>
                        <div class="relative">
                            <input type="password" id="password" required
                                   placeholder="Enter your password"
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10">
                            <button type="button" onclick="togglePassword()" 
                                    class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700">
                                <i id="password-icon" class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div id="error-message" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <span id="error-text"></span>
                    </div>

                    <!-- Login Button -->
                    <button type="submit" id="login-btn"
                            class="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition flex items-center justify-center">
                        <i class="fas fa-sign-in-alt mr-2"></i>
                        Login to ERCA System
                    </button>
                </form>

                <!-- Additional Info -->
                <div class="mt-6 pt-6 border-t border-gray-200">
                    <p class="text-center text-sm text-gray-600">
                        <i class="fas fa-shield-alt text-green-600 mr-1"></i>
                        Secure Government Portal
                    </p>
                    <p class="text-center text-xs text-gray-500 mt-2">
                        For authorized ERCA officials only
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div class="text-center mt-6">
                <p class="text-purple-200 text-sm">
                    © 2024 Ethiopian Revenue and Customs Authority
                </p>
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script>
          // Toggle password visibility
          function togglePassword() {
            const passwordInput = document.getElementById('password')
            const passwordIcon = document.getElementById('password-icon')
            
            if (passwordInput.type === 'password') {
              passwordInput.type = 'text'
              passwordIcon.classList.remove('fa-eye')
              passwordIcon.classList.add('fa-eye-slash')
            } else {
              passwordInput.type = 'password'
              passwordIcon.classList.remove('fa-eye-slash')
              passwordIcon.classList.add('fa-eye')
            }
          }

          // Show error message
          function showError(message) {
            const errorDiv = document.getElementById('error-message')
            const errorText = document.getElementById('error-text')
            errorText.textContent = message
            errorDiv.classList.remove('hidden')
          }

          // Hide error message
          function hideError() {
            document.getElementById('error-message').classList.add('hidden')
          }

          // Handle login form submission
          document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault()
            hideError()

            const loginBtn = document.getElementById('login-btn')
            const employeeId = document.getElementById('employee-id').value.trim()
            const password = document.getElementById('password').value

            // Validate inputs
            if (!employeeId || !password) {
              showError('Please enter both Employee ID and Password')
              return
            }

            // Disable button and show loading
            loginBtn.disabled = true
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Logging in...'

            try {
              const result = await ercaAuth.login(employeeId, password)

              if (result.success) {
                // Redirect based on URL parameter or default to dashboard
                const urlParams = new URLSearchParams(window.location.search)
                const redirect = urlParams.get('redirect') || '/erca-dashboard'
                window.location.href = redirect
              } else {
                showError(result.error || 'Invalid credentials')
                loginBtn.disabled = false
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login to ERCA System'
              }
            } catch (error) {
              console.error('Login error:', error)
              showError('An error occurred. Please try again.')
              loginBtn.disabled = false
              loginBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login to ERCA System'
            }
          })

          // Check if already logged in
          if (ercaAuth.isLoggedIn()) {
            const urlParams = new URLSearchParams(window.location.search)
            const redirect = urlParams.get('redirect') || '/erca-dashboard'
            window.location.href = redirect
          }
        </script>
    </body>
    </html>
  `)
})

// ERCA User Management Dashboard
app.get('/erca-dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Management - ERCA Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <!-- Top Navigation -->
        <nav class="bg-purple-900 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <div>
                            <h1 class="text-lg font-bold">ERCA Portal</h1>
                            <p class="text-xs text-purple-200">User Management System</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/analytics" class="text-purple-200 hover:text-white">
                            <i class="fas fa-chart-line mr-1"></i>Analytics
                        </a>
                        <a href="/erca-profile" class="text-purple-200 hover:text-white">
                            <i class="fas fa-user-circle mr-1"></i>Profile
                        </a>
                        <a href="/erca-audit-logs" class="text-purple-200 hover:text-white" id="audit-logs-link">
                            <i class="fas fa-history mr-1"></i>Audit Logs
                        </a>
                        <div class="text-right">
                            <p class="text-sm font-semibold" id="official-name">Loading...</p>
                            <p class="text-xs text-purple-200" id="official-rank">Loading...</p>
                        </div>
                        <button onclick="ercaAuth.logout()" 
                                class="bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg transition">
                            <i class="fas fa-sign-out-alt mr-2"></i>Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Page Header -->
            <div class="mb-8">
                <h2 class="text-3xl font-bold text-gray-900">
                    <i class="fas fa-users-cog text-purple-600 mr-2"></i>
                    ERCA Officials Management
                </h2>
                <p class="text-gray-600 mt-2">Manage government officials and their permissions</p>
            </div>

            <!-- Statistics Cards -->
            <div class="grid md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Total Officials</p>
                            <p class="text-3xl font-bold text-gray-900" id="total-officials">0</p>
                        </div>
                        <div class="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-users text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Active Officials</p>
                            <p class="text-3xl font-bold text-green-600" id="active-officials">0</p>
                        </div>
                        <div class="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-user-check text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Super Admins</p>
                            <p class="text-3xl font-bold text-yellow-600" id="super-admins">0</p>
                        </div>
                        <div class="bg-yellow-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-crown text-yellow-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Rank Distribution</p>
                            <p class="text-xs font-semibold text-gray-700" id="rank-distribution">Loading...</p>
                        </div>
                        <div class="bg-indigo-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-sitemap text-indigo-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filters and Actions -->
            <div class="bg-white rounded-xl shadow-md p-6 mb-6">
                <div class="grid md:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <input type="text" id="search-input" placeholder="Name, ID, or email..." 
                               onkeyup="filterOfficials()"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Rank Filter</label>
                        <select id="rank-filter" onchange="filterOfficials()"
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <option value="">All Ranks</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                        <select id="status-filter" onchange="filterOfficials()"
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button onclick="exportOfficialsToCSV()" 
                                class="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition">
                            <i class="fas fa-file-csv mr-2"></i>Export CSV
                        </button>
                    </div>
                    <div class="flex items-end">
                        <button onclick="openAddModal()" 
                                class="w-full bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition">
                            <i class="fas fa-plus mr-2"></i>Add Official
                        </button>
                    </div>
                </div>
            </div>

            <!-- Officials Table -->
            <div class="bg-white rounded-xl shadow-md overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Official</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="officials-table" class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>
                                    Loading officials...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Add/Edit Official Modal -->
        <div id="official-modal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="bg-purple-600 text-white px-6 py-4 rounded-t-2xl">
                    <h3 class="text-xl font-bold" id="modal-title">Add New ERCA Official</h3>
                </div>
                
                <form id="official-form" onsubmit="saveOfficial(event)" class="p-6">
                    <input type="hidden" id="official-id">
                    
                    <div class="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                            <input type="text" id="official-full-name" required
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Employee ID *</label>
                            <input type="text" id="official-employee-id" required
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                            <input type="email" id="official-email" required
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                            <input type="tel" id="official-phone" required placeholder="+251911000000"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Rank *</label>
                            <select id="official-rank" required
                                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Department</label>
                            <select id="official-department"
                                    class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            </select>
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Region</label>
                            <input type="text" id="official-region" placeholder="e.g., Addis Ababa"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Office Location</label>
                            <input type="text" id="official-office" placeholder="e.g., Main Office"
                                   class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </div>
                    </div>

                    <div class="flex justify-end space-x-4">
                        <button type="button" onclick="closeModal()"
                                class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                            Cancel
                        </button>
                        <button type="submit"
                                class="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition">
                            Save Official
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script src="/static/erca-user-management.js"></script>
        <script>
          // Update user info in header
          if (ercaAuth.isLoggedIn()) {
            const official = ercaAuth.getCurrentOfficial()
            document.getElementById('official-name').textContent = official.full_name
            document.getElementById('official-rank').textContent = official.rank_name + ' | ' + official.department
            
            // Hide audit logs link if not super admin
            if (!ercaAuth.isSuperAdmin()) {
              const auditLogsLink = document.getElementById('audit-logs-link')
              if (auditLogsLink) auditLogsLink.style.display = 'none'
            }
          }
        </script>
    </body>
    </html>
  `)
})

// ERCA Audit Logs Viewer
app.get('/erca-audit-logs', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Audit Logs - ERCA Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <!-- Top Navigation -->
        <nav class="bg-purple-900 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <div>
                            <h1 class="text-lg font-bold">ERCA Portal</h1>
                            <p class="text-xs text-purple-200">Audit Logs</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/erca-dashboard" class="text-purple-200 hover:text-white">
                            <i class="fas fa-users-cog mr-2"></i>Officials
                        </a>
                        <a href="/analytics" class="text-purple-200 hover:text-white">
                            <i class="fas fa-chart-line mr-2"></i>Analytics
                        </a>
                        <button onclick="ercaAuth.logout()" 
                                class="bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg transition">
                            <i class="fas fa-sign-out-alt mr-2"></i>Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Page Header -->
            <div class="mb-8">
                <h2 class="text-3xl font-bold text-gray-900">
                    <i class="fas fa-history text-purple-600 mr-2"></i>
                    System Audit Logs
                </h2>
                <p class="text-gray-600 mt-2">Complete audit trail of all official actions</p>
            </div>

            <!-- Statistics Cards -->
            <div class="grid md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Total Logs</p>
                            <p class="text-3xl font-bold text-gray-900" id="total-logs">0</p>
                        </div>
                        <div class="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-list text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Unique Officials</p>
                            <p class="text-3xl font-bold text-blue-600" id="unique-officials">0</p>
                        </div>
                        <div class="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-users text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Action Types</p>
                            <p class="text-3xl font-bold text-green-600" id="total-actions">0</p>
                        </div>
                        <div class="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-tasks text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">Most Common</p>
                            <p class="text-sm font-semibold text-gray-700" id="common-action">Loading...</p>
                        </div>
                        <div class="bg-yellow-100 w-12 h-12 rounded-full flex items-center justify-center">
                            <i class="fas fa-chart-bar text-yellow-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filters and Actions -->
            <div class="bg-white rounded-xl shadow-md p-6 mb-6">
                <div class="grid md:grid-cols-5 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <input type="text" id="search-input" placeholder="Official name or ID..." 
                               onkeyup="filterLogs()"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Action Filter</label>
                        <select id="action-filter" onchange="filterLogs()"
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <option value="">All Actions</option>
                            <option value="login">Login</option>
                            <option value="logout">Logout</option>
                            <option value="create_user">Create User</option>
                            <option value="update_user">Update User</option>
                            <option value="view_business">View Business</option>
                            <option value="verify_invoice">Verify Invoice</option>
                            <option value="generate_report">Generate Report</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Date Filter</label>
                        <input type="date" id="date-filter" onchange="filterLogs()"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Limit</label>
                        <select id="limit-select" onchange="loadMoreLogs()"
                                class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                            <option value="100">100 logs</option>
                            <option value="200">200 logs</option>
                            <option value="500">500 logs</option>
                            <option value="1000">1000 logs</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button onclick="exportToCSV()" 
                                class="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition">
                            <i class="fas fa-file-csv mr-2"></i>Export CSV
                        </button>
                    </div>
                </div>
            </div>

            <!-- Audit Logs Table -->
            <div class="bg-white rounded-xl shadow-md overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Official</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity Type</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody id="audit-logs-table" class="bg-white divide-y divide-gray-200">
                            <tr>
                                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>
                                    Loading audit logs...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script src="/static/erca-audit-logs.js"></script>
    </body>
    </html>
  `)
})

// ERCA Profile Management
app.get('/erca-profile', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Profile - ERCA Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <!-- Top Navigation -->
        <nav class="bg-purple-900 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <div>
                            <h1 class="text-lg font-bold">ERCA Portal</h1>
                            <p class="text-xs text-purple-200">My Profile</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/erca-dashboard" class="text-purple-200 hover:text-white">
                            <i class="fas fa-users-cog mr-2"></i>Officials
                        </a>
                        <a href="/analytics" class="text-purple-200 hover:text-white">
                            <i class="fas fa-chart-line mr-2"></i>Analytics
                        </a>
                        <button onclick="ercaAuth.logout()" 
                                class="bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg transition">
                            <i class="fas fa-sign-out-alt mr-2"></i>Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Profile Header -->
            <div class="bg-white rounded-xl shadow-md overflow-hidden mb-6">
                <div class="bg-gradient-to-r from-purple-600 to-indigo-600 h-32"></div>
                <div class="px-6 pb-6">
                    <div class="-mt-16 mb-4">
                        <div class="w-32 h-32 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                            <span class="text-5xl font-bold text-purple-600" id="profile-initial">?</span>
                        </div>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-900" id="profile-name">Loading...</h2>
                    <p class="text-gray-600" id="profile-rank">Loading...</p>
                    <div class="mt-4 flex items-center space-x-4 text-sm text-gray-600">
                        <span><i class="fas fa-id-badge mr-1"></i><span id="profile-employee-id">-</span></span>
                        <span><i class="fas fa-building mr-1"></i><span id="profile-department">-</span></span>
                        <span><i class="fas fa-map-marker-alt mr-1"></i><span id="profile-region">-</span></span>
                    </div>
                </div>
            </div>

            <!-- Profile Details -->
            <div class="grid md:grid-cols-2 gap-6 mb-6">
                <div class="bg-white rounded-xl shadow-md p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">
                        <i class="fas fa-user text-purple-600 mr-2"></i>
                        Personal Information
                    </h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm text-gray-500">Full Name</label>
                            <p class="font-semibold text-gray-900" id="info-name">-</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">Employee ID</label>
                            <p class="font-semibold text-gray-900" id="info-employee-id">-</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">Email</label>
                            <p class="font-semibold text-gray-900" id="info-email">-</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">Phone</label>
                            <p class="font-semibold text-gray-900" id="info-phone">-</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-md p-6">
                    <h3 class="text-lg font-bold text-gray-900 mb-4">
                        <i class="fas fa-briefcase text-purple-600 mr-2"></i>
                        Official Information
                    </h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm text-gray-500">Rank</label>
                            <p class="font-semibold text-gray-900" id="info-rank">-</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">Department</label>
                            <p class="font-semibold text-gray-900" id="info-department">-</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">Region</label>
                            <p class="font-semibold text-gray-900" id="info-region">-</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">Office Location</label>
                            <p class="font-semibold text-gray-900" id="info-office">-</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Change Password Section -->
            <div class="bg-white rounded-xl shadow-md p-6">
                <h3 class="text-lg font-bold text-gray-900 mb-4">
                    <i class="fas fa-key text-purple-600 mr-2"></i>
                    Change Password
                </h3>
                <form id="password-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                        <input type="password" id="current-password" required
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <input type="password" id="new-password" required minlength="8"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <p class="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                        <input type="password" id="confirm-password" required minlength="8"
                               class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                    </div>
                    <button type="submit" id="change-password-btn"
                            class="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition">
                        <i class="fas fa-save mr-2"></i>Change Password
                    </button>
                </form>
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script>
          let currentOfficial = null

          // Load profile data
          async function loadProfile() {
            const isAuth = await ercaAuth.requireAuth()
            if (!isAuth) return

            currentOfficial = ercaAuth.getCurrentOfficial()

            // Update profile display
            document.getElementById('profile-initial').textContent = currentOfficial.full_name.charAt(0).toUpperCase()
            document.getElementById('profile-name').textContent = currentOfficial.full_name
            document.getElementById('profile-rank').textContent = currentOfficial.rank_name
            document.getElementById('profile-employee-id').textContent = currentOfficial.employee_id
            document.getElementById('profile-department').textContent = currentOfficial.department || 'N/A'
            document.getElementById('profile-region').textContent = currentOfficial.region || 'N/A'

            // Update info section
            document.getElementById('info-name').textContent = currentOfficial.full_name
            document.getElementById('info-employee-id').textContent = currentOfficial.employee_id
            document.getElementById('info-email').textContent = currentOfficial.email
            document.getElementById('info-phone').textContent = currentOfficial.phone || 'N/A'
            document.getElementById('info-rank').textContent = currentOfficial.rank_name
            document.getElementById('info-department').textContent = currentOfficial.department || 'N/A'
            document.getElementById('info-region').textContent = currentOfficial.region || 'N/A'
            document.getElementById('info-office').textContent = currentOfficial.office_location || 'N/A'
          }

          // Handle password change
          document.getElementById('password-form').addEventListener('submit', async (e) => {
            e.preventDefault()

            const currentPassword = document.getElementById('current-password').value
            const newPassword = document.getElementById('new-password').value
            const confirmPassword = document.getElementById('confirm-password').value

            if (newPassword !== confirmPassword) {
              alert('New passwords do not match!')
              return
            }

            const btn = document.getElementById('change-password-btn')
            btn.disabled = true
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Changing...'

            try {
              const response = await axios.post('/api/erca/auth/change-password', {
                employee_id: currentOfficial.employee_id,
                current_password: currentPassword,
                new_password: newPassword
              }, {
                headers: { 'Authorization': \`Bearer \${ercaAuth.getSessionToken()}\` }
              })

              if (response.data.success) {
                alert('Password changed successfully! Please login again.')
                ercaAuth.logout()
              } else {
                alert(response.data.error || 'Failed to change password')
                btn.disabled = false
                btn.innerHTML = '<i class="fas fa-save mr-2"></i>Change Password'
              }
            } catch (error) {
              alert(error.response?.data?.error || 'Error changing password')
              btn.disabled = false
              btn.innerHTML = '<i class="fas fa-save mr-2"></i>Change Password'
            }
          })

          // Initialize
          loadProfile()
        </script>
    </body>
    </html>
  `)
})

// ============================================
// ERCA USER MANAGEMENT SYSTEM
// ============================================

// Utility: Hash password using SHA-256
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// Utility: Generate session token
function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Setup Super Admin (One-time only)
app.post('/api/erca/admin/setup', async (c) => {
  const { DB } = c.env
  const { full_name, employee_id, email, phone, password, setup_key } = await c.req.json()
  
  const SETUP_KEY = 'ERCA_SUPER_ADMIN_SETUP_2025' // Change in production!
  
  try {
    // Verify setup key
    if (setup_key !== SETUP_KEY) {
      return c.json({ error: 'Invalid setup key' }, 403)
    }
    
    // Check if super admin already exists
    const existing = await DB.prepare(
      'SELECT id FROM erca_officials WHERE is_super_admin = 1'
    ).first()
    
    if (existing) {
      return c.json({ error: 'Super admin already exists' }, 400)
    }
    
    // Hash password
    const password_hash = await hashPassword(password)
    
    // Create super admin
    const result = await DB.prepare(`
      INSERT INTO erca_officials (full_name, employee_id, email, phone, password_hash, rank, department, is_super_admin, is_active)
      VALUES (?, ?, ?, ?, ?, 'cg', 'Administration', 1, 1)
    `).bind(full_name, employee_id, email, phone, password_hash).run()
    
    return c.json({ 
      success: true, 
      message: 'ERCA Super Admin created successfully',
      official_id: result.meta.last_row_id
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// ERCA Official Login
app.post('/api/erca/auth/login', async (c) => {
  const { DB } = c.env
  const { employee_id, password } = await c.req.json()
  
  try {
    // Hash password for comparison
    const password_hash = await hashPassword(password)
    
    // Find official
    const official: any = await DB.prepare(`
      SELECT 
        o.id, o.full_name, o.employee_id, o.email, o.phone, 
        o.rank, o.department, o.region, o.office_location,
        o.is_super_admin, o.is_active,
        r.rank_name, r.rank_level, r.can_manage_users, 
        r.can_audit_businesses, r.can_verify_invoices, 
        r.can_generate_reports, r.can_configure_system
      FROM erca_officials o
      LEFT JOIN erca_ranks r ON o.rank = r.rank_code
      WHERE o.employee_id = ? AND o.password_hash = ?
    `).bind(employee_id, password_hash).first()
    
    if (!official) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    if (!official.is_active) {
      return c.json({ error: 'Account is inactive' }, 403)
    }
    
    // Generate session token
    const session_token = generateSessionToken()
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    
    // Create session
    await DB.prepare(`
      INSERT INTO erca_sessions (official_id, session_token, expires_at)
      VALUES (?, ?, ?)
    `).bind(official.id, session_token, expires_at).run()
    
    // Update last login
    await DB.prepare(`
      UPDATE erca_officials SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(official.id).run()
    
    // Log audit trail
    await DB.prepare(`
      INSERT INTO erca_audit_logs (official_id, action, details)
      VALUES (?, 'login', '{"method":"password"}')
    `).bind(official.id).run()
    
    return c.json({
      success: true,
      session_token,
      expires_at,
      official: {
        id: official.id,
        full_name: official.full_name,
        employee_id: official.employee_id,
        email: official.email,
        rank: official.rank,
        rank_name: official.rank_name,
        rank_level: official.rank_level,
        department: official.department,
        region: official.region,
        is_super_admin: official.is_super_admin,
        permissions: {
          can_manage_users: official.can_manage_users,
          can_audit_businesses: official.can_audit_businesses,
          can_verify_invoices: official.can_verify_invoices,
          can_generate_reports: official.can_generate_reports,
          can_configure_system: official.can_configure_system
        }
      }
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Validate Session
app.post('/api/erca/auth/validate', async (c) => {
  const { DB } = c.env
  const { session_token } = await c.req.json()
  
  try {
    const session: any = await DB.prepare(`
      SELECT o.id, o.full_name, o.employee_id, o.rank, o.is_super_admin, s.expires_at
      FROM erca_sessions s
      JOIN erca_officials o ON s.official_id = o.id
      WHERE s.session_token = ? AND o.is_active = 1
    `).bind(session_token).first()
    
    if (!session) {
      return c.json({ valid: false, error: 'Invalid session' }, 401)
    }
    
    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      return c.json({ valid: false, error: 'Session expired' }, 401)
    }
    
    return c.json({ valid: true, official: session })
  } catch (error: any) {
    return c.json({ valid: false, error: error.message }, 500)
  }
})

// Logout
app.post('/api/erca/auth/logout', async (c) => {
  const { DB } = c.env
  const { session_token } = await c.req.json()
  
  try {
    await DB.prepare('DELETE FROM erca_sessions WHERE session_token = ?').bind(session_token).run()
    return c.json({ success: true })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get All ERCA Officials (requires super admin or user management permission)
app.get('/api/erca/admin/officials', async (c) => {
  const { DB } = c.env
  const auth_token = c.req.header('Authorization')?.replace('Bearer ', '')
  
  try {
    // Validate session
    const session: any = await DB.prepare(`
      SELECT o.id, o.is_super_admin, o.can_manage_officials
      FROM erca_sessions s
      JOIN erca_officials o ON s.official_id = o.id
      WHERE s.session_token = ? AND o.is_active = 1 AND s.expires_at > datetime('now')
    `).bind(auth_token).first()
    
    if (!session || (!session.is_super_admin && !session.can_manage_officials)) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Get all officials
    const { results } = await DB.prepare(`
      SELECT 
        id, full_name, employee_id, email, phone,
        department, rank_name, office_location, 
        is_super_admin, is_active,
        can_view_businesses, can_view_transactions, can_view_reports,
        can_manage_officials, can_audit_businesses, can_issue_penalties,
        created_at, last_login
      FROM erca_officials
      ORDER BY full_name ASC
    `).all()
    
    return c.json({ officials: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Create New ERCA Official
app.post('/api/erca/admin/officials', async (c) => {
  const { DB } = c.env
  const auth_token = c.req.header('Authorization')?.replace('Bearer ', '')
  const officialData = await c.req.json()
  
  try {
    // Validate session
    const session: any = await DB.prepare(`
      SELECT o.id, o.is_super_admin, o.can_manage_officials
      FROM erca_sessions s
      JOIN erca_officials o ON s.official_id = o.id
      WHERE s.session_token = ? AND o.is_active = 1 AND s.expires_at > datetime('now')
    `).bind(auth_token).first()
    
    if (!session || (!session.is_super_admin && !session.can_manage_officials)) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Hash password
    const password_hash = await hashPassword(officialData.password || '1234') // Default password
    
    // Create official
    const result = await DB.prepare(`
      INSERT INTO erca_officials 
        (full_name, employee_id, email, phone, password_hash, rank_name, department, office_location, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      officialData.full_name,
      officialData.employee_id,
      officialData.email,
      officialData.phone,
      password_hash,
      officialData.rank_name || 'Official',
      officialData.department || 'General',
      officialData.office_location || null,
      session.id
    ).run()
    
    // Log audit trail
    await DB.prepare(`
      INSERT INTO erca_audit_logs (official_id, action, entity_type, entity_id, details)
      VALUES (?, 'create_user', 'official', ?, ?)
    `).bind(
      session.id,
      result.meta.last_row_id,
      JSON.stringify({ employee_id: officialData.employee_id, rank: officialData.rank })
    ).run()
    
    return c.json({ 
      success: true, 
      official_id: result.meta.last_row_id,
      message: 'ERCA official created successfully',
      default_password: '1234'
    })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Update ERCA Official
app.put('/api/erca/admin/officials/:id', async (c) => {
  const { DB } = c.env
  const auth_token = c.req.header('Authorization')?.replace('Bearer ', '')
  const official_id = c.req.param('id')
  const updates = await c.req.json()
  
  try {
    // Validate session
    const session: any = await DB.prepare(`
      SELECT o.id, o.is_super_admin, o.can_manage_officials
      FROM erca_sessions s
      JOIN erca_officials o ON s.official_id = o.id
      WHERE s.session_token = ? AND o.is_active = 1 AND s.expires_at > datetime('now')
    `).bind(auth_token).first()
    
    if (!session || (!session.is_super_admin && !session.can_manage_officials)) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Update official
    const updateFields = []
    const updateValues = []
    
    if (updates.full_name) {
      updateFields.push('full_name = ?')
      updateValues.push(updates.full_name)
    }
    if (updates.email) {
      updateFields.push('email = ?')
      updateValues.push(updates.email)
    }
    if (updates.phone) {
      updateFields.push('phone = ?')
      updateValues.push(updates.phone)
    }
    if (updates.rank_name) {
      updateFields.push('rank_name = ?')
      updateValues.push(updates.rank_name)
    }
    if (updates.department) {
      updateFields.push('department = ?')
      updateValues.push(updates.department)
    }
    if (updates.office_location) {
      updateFields.push('office_location = ?')
      updateValues.push(updates.office_location)
    }
    if (updates.is_active !== undefined) {
      updateFields.push('is_active = ?')
      updateValues.push(updates.is_active)
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP')
    updateValues.push(official_id)
    
    await DB.prepare(`
      UPDATE erca_officials 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...updateValues).run()
    
    // Log audit trail
    await DB.prepare(`
      INSERT INTO erca_audit_logs (official_id, action, entity_type, entity_id, details)
      VALUES (?, 'update_user', 'official', ?, ?)
    `).bind(session.id, official_id, JSON.stringify(updates)).run()
    
    return c.json({ success: true, message: 'Official updated successfully' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get ERCA Ranks
app.get('/api/erca/admin/ranks', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT * FROM erca_ranks ORDER BY rank_level ASC
    `).all()
    
    return c.json({ ranks: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get ERCA Departments
app.get('/api/erca/admin/departments', async (c) => {
  const { DB } = c.env
  
  try {
    const { results } = await DB.prepare(`
      SELECT * FROM erca_departments WHERE is_active = 1 ORDER BY department_name ASC
    `).all()
    
    return c.json({ departments: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Get Audit Logs
app.get('/api/erca/admin/audit-logs', async (c) => {
  const { DB } = c.env
  const auth_token = c.req.header('Authorization')?.replace('Bearer ', '')
  const limit = parseInt(c.req.query('limit') || '100')
  
  try {
    // Validate session
    const session: any = await DB.prepare(`
      SELECT o.is_super_admin
      FROM erca_sessions s
      JOIN erca_officials o ON s.official_id = o.id
      WHERE s.session_token = ? AND o.is_active = 1 AND s.expires_at > datetime('now')
    `).bind(auth_token).first()
    
    if (!session || !session.is_super_admin) {
      return c.json({ error: 'Unauthorized - Super admin access required' }, 403)
    }
    
    const { results } = await DB.prepare(`
      SELECT 
        a.id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
        o.full_name, o.employee_id, o.rank_name as rank
      FROM erca_audit_logs a
      JOIN erca_officials o ON a.official_id = o.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).bind(limit).all()
    
    return c.json({ logs: results })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Change Password
app.post('/api/erca/auth/change-password', async (c) => {
  const { DB } = c.env
  const auth_token = c.req.header('Authorization')?.replace('Bearer ', '')
  const { employee_id, current_password, new_password } = await c.req.json()
  
  try {
    // Validate session
    const session: any = await DB.prepare(`
      SELECT o.id
      FROM erca_sessions s
      JOIN erca_officials o ON s.official_id = o.id
      WHERE s.session_token = ? AND o.is_active = 1 AND s.expires_at > datetime('now')
    `).bind(auth_token).first()
    
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    
    // Verify current password
    const current_password_hash = await hashPassword(current_password)
    const official: any = await DB.prepare(`
      SELECT id FROM erca_officials 
      WHERE employee_id = ? AND password_hash = ?
    `).bind(employee_id, current_password_hash).first()
    
    if (!official) {
      return c.json({ error: 'Current password is incorrect' }, 401)
    }
    
    // Update password
    const new_password_hash = await hashPassword(new_password)
    await DB.prepare(`
      UPDATE erca_officials 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(new_password_hash, official.id).run()
    
    // Log audit trail
    await DB.prepare(`
      INSERT INTO erca_audit_logs (official_id, action, details)
      VALUES (?, 'password_change', '{"success":true}')
    `).bind(session.id).run()
    
    // Delete all sessions for this user (force re-login)
    await DB.prepare(`
      DELETE FROM erca_sessions WHERE official_id = ?
    `).bind(official.id).run()
    
    return c.json({ success: true, message: 'Password changed successfully' })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// Invoice Verification Page
app.get('/verify-invoice', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Verification - ERCA Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <style>
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
          }
        </style>
    </head>
    <body class="bg-gray-100">
        <!-- Top Navigation -->
        <nav class="bg-purple-900 text-white shadow-lg no-print">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <div>
                            <h1 class="text-lg font-bold">ERCA Portal</h1>
                            <p class="text-xs text-purple-200">Invoice Verification</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/erca-dashboard" class="hover:bg-purple-800 px-3 py-2 rounded-md text-sm">
                            <i class="fas fa-home mr-1"></i> Dashboard
                        </a>
                        <button onclick="ercaAuth.logout()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm">
                            <i class="fas fa-sign-out-alt mr-1"></i> Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Page Header -->
            <div class="mb-8 no-print">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">
                    <i class="fas fa-search text-purple-600 mr-2"></i>
                    Invoice Verification
                </h1>
                <p class="text-gray-600">Verify the authenticity of business invoices registered with ERCA</p>
            </div>

            <!-- Search Form -->
            <div class="bg-white rounded-lg shadow-lg p-8 mb-6 no-print">
                <form id="verify-form" class="max-w-2xl mx-auto">
                    <div class="flex items-center space-x-4">
                        <div class="flex-1">
                            <label for="invoice-number" class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-file-invoice mr-1"></i>
                                Enter Invoice Number
                            </label>
                            <input 
                                type="text" 
                                id="invoice-number" 
                                name="invoice_number"
                                placeholder="INV-20251117-0001"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
                                required
                                autofocus
                            >
                        </div>
                        <div class="pt-7">
                            <button 
                                type="submit"
                                class="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition font-semibold"
                            >
                                <i class="fas fa-search mr-2"></i>
                                Verify
                            </button>
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 mt-3">
                        <i class="fas fa-info-circle mr-1"></i>
                        Invoice numbers are case-sensitive. Format: INV-YYYYMMDD-XXXX
                    </p>
                </form>
            </div>

            <!-- Loading State -->
            <div id="loading-state" class="hidden text-center py-12">
                <i class="fas fa-spinner fa-spin text-4xl text-purple-600 mb-4"></i>
                <p class="text-gray-600">Verifying invoice...</p>
            </div>

            <!-- Error State -->
            <div id="error-state" class="hidden bg-red-50 border-l-4 border-red-500 p-6 rounded-lg">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-red-500 text-2xl mr-4"></i>
                    <div>
                        <h3 class="text-lg font-semibold text-red-800">Invoice Not Found</h3>
                        <p class="text-red-700 mt-1">Error message will appear here</p>
                    </div>
                </div>
            </div>

            <!-- Verification Results -->
            <div id="verification-results" class="hidden">
                <!-- Results will be dynamically inserted here -->
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script src="/static/invoice-verification.js"></script>
    </body>
    </html>
  `)
})

// Business Monitoring Dashboard
app.get('/business-monitoring', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Business Monitoring - ERCA Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-100">
        <!-- Top Navigation -->
        <nav class="bg-purple-900 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <div>
                            <h1 class="text-lg font-bold">ERCA Portal</h1>
                            <p class="text-xs text-purple-200">Business Monitoring</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/erca-dashboard" class="hover:bg-purple-800 px-3 py-2 rounded-md text-sm">
                            <i class="fas fa-home mr-1"></i> Dashboard
                        </a>
                        <button onclick="ercaAuth.logout()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm">
                            <i class="fas fa-sign-out-alt mr-1"></i> Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Page Header -->
            <div class="mb-6">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">
                    <i class="fas fa-building text-purple-600 mr-2"></i>
                    Business Monitoring
                </h1>
                <p class="text-gray-600">Real-time monitoring of all registered businesses with transaction data and compliance status</p>
            </div>

            <!-- Summary Statistics -->
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">Total Businesses</p>
                            <p id="total-businesses" class="text-2xl font-bold text-gray-900">0</p>
                        </div>
                        <i class="fas fa-building text-3xl text-gray-400"></i>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">Active</p>
                            <p id="active-businesses" class="text-2xl font-bold text-green-600">0</p>
                        </div>
                        <i class="fas fa-check-circle text-3xl text-green-400"></i>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">Total Revenue</p>
                            <p id="total-revenue" class="text-xl font-bold text-gray-900">ETB 0</p>
                        </div>
                        <i class="fas fa-dollar-sign text-3xl text-indigo-400"></i>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">Total VAT</p>
                            <p id="total-vat" class="text-xl font-bold text-gray-900">ETB 0</p>
                        </div>
                        <i class="fas fa-coins text-3xl text-yellow-400"></i>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">Transactions</p>
                            <p id="total-transactions" class="text-2xl font-bold text-gray-900">0</p>
                        </div>
                        <i class="fas fa-exchange-alt text-3xl text-blue-400"></i>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">Avg Compliance</p>
                            <p id="avg-compliance" class="text-2xl font-bold text-gray-900">0%</p>
                        </div>
                        <i class="fas fa-chart-line text-3xl text-purple-400"></i>
                    </div>
                </div>
            </div>

            <!-- Filters and Actions -->
            <div class="bg-white rounded-lg shadow mb-6 p-4">
                <div class="flex flex-wrap items-center gap-4">
                    <div class="flex-1 min-w-64">
                        <input 
                            type="text" 
                            id="filter-input" 
                            placeholder="Search by name, TIN, city, or type..."
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                    </div>
                    <div>
                        <select 
                            id="compliance-filter"
                            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">All Compliance Levels</option>
                            <option value="compliant">Compliant (≥95%)</option>
                            <option value="partial">Partial (70-94%)</option>
                            <option value="non-compliant">Non-Compliant (<70%)</option>
                        </select>
                    </div>
                    <div>
                        <button 
                            onclick="exportToCSV()"
                            class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                            <i class="fas fa-file-csv mr-2"></i>
                            Export CSV
                        </button>
                    </div>
                </div>
                <div class="mt-2">
                    <p id="results-count" class="text-sm text-gray-600">Loading...</p>
                </div>
            </div>

            <!-- Loading State -->
            <div id="loading-state" class="bg-white rounded-lg shadow p-8 text-center">
                <i class="fas fa-spinner fa-spin text-4xl text-purple-600 mb-4"></i>
                <p class="text-gray-600">Loading businesses...</p>
            </div>

            <!-- Businesses Table -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TIN</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">VAT</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="businesses-tbody" class="bg-white divide-y divide-gray-200">
                            <!-- Data will be inserted here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script src="/static/business-monitoring.js"></script>
    </body>
    </html>
  `)
})

// Business Profile/Details Page
app.get('/business-details', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Business Profile - ERCA Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-100">
        <!-- Navigation -->
        <nav class="bg-purple-900 text-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <div>
                            <h1 class="text-lg font-bold">ERCA Portal</h1>
                            <p class="text-xs text-purple-200">Business Profile</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/business-monitoring" class="text-purple-200 hover:text-white">
                            <i class="fas fa-building mr-1"></i>Businesses
                        </a>
                        <a href="/analytics" class="text-purple-200 hover:text-white">
                            <i class="fas fa-chart-line mr-1"></i>Analytics
                        </a>
                        <a href="/erca-dashboard" class="text-purple-200 hover:text-white">
                            <i class="fas fa-users-cog mr-1"></i>Officials
                        </a>
                        <button onclick="ercaAuth.logout()" 
                                class="bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg transition">
                            <i class="fas fa-sign-out-alt mr-2"></i>Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Loading State -->
            <div id="loading-state" class="text-center py-12">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p class="mt-4 text-gray-600">Loading business profile...</p>
            </div>

            <!-- Error State -->
            <div id="error-state" class="hidden">
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                    <p id="error-message"></p>
                </div>
                <a href="/business-monitoring" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-arrow-left mr-1"></i> Back to Business Monitoring
                </a>
            </div>

            <!-- Business Profile Content -->
            <div id="profile-content" class="hidden">
                <!-- Header with Business Name and Status -->
                <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <div class="bg-blue-100 rounded-full p-4">
                                <i class="fas fa-building text-3xl text-blue-600"></i>
                            </div>
                            <div>
                                <h1 class="text-3xl font-bold text-gray-900" id="business-name">...</h1>
                                <p class="text-gray-600" id="business-subtitle">...</p>
                            </div>
                        </div>
                        <div id="sync-status-badge" class="text-right">
                            <!-- Status badge will be inserted here -->
                        </div>
                    </div>
                </div>

                <!-- Key Statistics -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">Total Transactions</p>
                                <p class="text-2xl font-bold text-gray-900" id="stat-transactions">0</p>
                            </div>
                            <div class="bg-blue-100 rounded-full p-3">
                                <i class="fas fa-receipt text-blue-600 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">Total Revenue</p>
                                <p class="text-2xl font-bold text-gray-900" id="stat-revenue">ETB 0</p>
                            </div>
                            <div class="bg-green-100 rounded-full p-3">
                                <i class="fas fa-money-bill-wave text-green-600 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">VAT Collected</p>
                                <p class="text-2xl font-bold text-gray-900" id="stat-vat">ETB 0</p>
                            </div>
                            <div class="bg-purple-100 rounded-full p-3">
                                <i class="fas fa-percentage text-purple-600 text-xl"></i>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">Compliance Rate</p>
                                <p class="text-2xl font-bold text-gray-900" id="stat-compliance">0%</p>
                            </div>
                            <div class="bg-yellow-100 rounded-full p-3">
                                <i class="fas fa-chart-line text-yellow-600 text-xl"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab Navigation -->
                <div class="bg-white rounded-lg shadow mb-6">
                    <div class="border-b border-gray-200">
                        <nav class="flex -mb-px">
                            <button onclick="switchTab('overview')" 
                                    class="tab-btn border-b-2 border-blue-500 text-blue-600 py-4 px-6 font-semibold"
                                    id="tab-overview">
                                <i class="fas fa-info-circle mr-2"></i>Overview
                            </button>
                            <button onclick="switchTab('contact')" 
                                    class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-6 font-semibold"
                                    id="tab-contact">
                                <i class="fas fa-address-card mr-2"></i>Contact & Location
                            </button>
                            <button onclick="switchTab('tax')" 
                                    class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-6 font-semibold"
                                    id="tab-tax">
                                <i class="fas fa-file-invoice-dollar mr-2"></i>Tax Information
                            </button>
                            <button onclick="switchTab('activity')" 
                                    class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-6 font-semibold"
                                    id="tab-activity">
                                <i class="fas fa-chart-bar mr-2"></i>Transaction Activity
                            </button>
                        </nav>
                    </div>

                    <!-- Tab Content -->
                    <div class="p-6">
                        <!-- Overview Tab -->
                        <div id="content-overview" class="tab-content">
                            <h3 class="text-xl font-semibold text-gray-900 mb-4">Business Overview</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">TIN</p>
                                    <p class="text-lg font-semibold text-gray-900 font-mono" id="info-tin">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Business Type</p>
                                    <p class="text-lg font-semibold text-gray-900" id="info-type">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Business Size</p>
                                    <p class="text-lg font-semibold text-gray-900" id="info-size">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Number of Employees</p>
                                    <p class="text-lg font-semibold text-gray-900" id="info-employees">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Trade License Number</p>
                                    <p class="text-lg font-semibold text-gray-900" id="info-license">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Registration Date</p>
                                    <p class="text-lg font-semibold text-gray-900" id="info-registered">...</p>
                                </div>
                                <div class="md:col-span-2">
                                    <p class="text-sm text-gray-600 mb-1">Operating Hours</p>
                                    <p class="text-lg font-semibold text-gray-900" id="info-hours">...</p>
                                </div>
                                <div class="md:col-span-2">
                                    <p class="text-sm text-gray-600 mb-1">Subscription Status</p>
                                    <div id="info-subscription">...</div>
                                </div>
                            </div>
                        </div>

                        <!-- Contact Tab -->
                        <div id="content-contact" class="tab-content hidden">
                            <h3 class="text-xl font-semibold text-gray-900 mb-4">Contact Information & Location</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Phone Number</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-phone">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Email Address</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-email">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Region</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-region">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">City</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-city">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Sub-City</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-subcity">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Kebele</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-kebele">...</p>
                                </div>
                                <div class="md:col-span-2">
                                    <p class="text-sm text-gray-600 mb-1">Street Address</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-street">...</p>
                                </div>
                                <div class="md:col-span-2">
                                    <p class="text-sm text-gray-600 mb-1">Full Address</p>
                                    <p class="text-lg font-semibold text-gray-900" id="contact-full">...</p>
                                </div>
                            </div>
                        </div>

                        <!-- Tax Tab -->
                        <div id="content-tax" class="tab-content hidden">
                            <h3 class="text-xl font-semibold text-gray-900 mb-4">Tax Configuration & Compliance</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Tax Type</p>
                                    <p class="text-lg font-semibold text-gray-900" id="tax-type">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">VAT Rate</p>
                                    <p class="text-lg font-semibold text-gray-900" id="tax-vat-rate">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Turnover Tax Rate</p>
                                    <p class="text-lg font-semibold text-gray-900" id="tax-turnover-rate">...</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">ERCA Sync Status</p>
                                    <div id="tax-sync-status">...</div>
                                </div>
                                <div class="md:col-span-2">
                                    <p class="text-sm text-gray-600 mb-1">Total Tax Collected (All Time)</p>
                                    <p class="text-2xl font-bold text-green-600" id="tax-total-collected">ETB 0</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Synced Transactions</p>
                                    <p class="text-lg font-semibold text-gray-900" id="tax-synced">0</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">Pending Sync</p>
                                    <p class="text-lg font-semibold text-gray-900" id="tax-pending">0</p>
                                </div>
                            </div>
                        </div>

                        <!-- Activity Tab -->
                        <div id="content-activity" class="tab-content hidden">
                            <h3 class="text-xl font-semibold text-gray-900 mb-4">Transaction Activity</h3>
                            
                            <!-- Activity Chart -->
                            <div class="bg-gray-50 rounded-lg p-4 mb-6">
                                <canvas id="activity-chart" height="80"></canvas>
                            </div>

                            <!-- Recent Transactions -->
                            <h4 class="text-lg font-semibold text-gray-900 mb-3">Recent Transactions</h4>
                            <div class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-200">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VAT</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="recent-transactions" class="bg-white divide-y divide-gray-200">
                                        <tr>
                                            <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                                                Loading transactions...
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script src="/static/business-profile.js"></script>
    </body>
    </html>
  `)
})

// Compliance Report Page
app.get('/compliance-report', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Compliance Report - ERCA Portal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <style>
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
          }
        </style>
    </head>
    <body class="bg-gray-100">
        <nav class="bg-purple-900 text-white shadow-lg no-print">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <i class="fas fa-landmark text-2xl mr-3"></i>
                        <div>
                            <h1 class="text-lg font-bold">ERCA Portal</h1>
                            <p class="text-xs text-purple-200">Compliance Report</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/erca-dashboard" class="hover:bg-purple-800 px-3 py-2 rounded-md text-sm">
                            <i class="fas fa-home mr-1"></i> Dashboard
                        </a>
                        <button onclick="ercaAuth.logout()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm">
                            <i class="fas fa-sign-out-alt mr-1"></i> Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="mb-6 flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 mb-2">
                        <i class="fas fa-chart-pie text-purple-600 mr-2"></i>
                        Tax Compliance Report
                    </h1>
                    <p class="text-gray-600">Businesses categorized by compliance rates</p>
                </div>
                <div class="flex items-center space-x-4 no-print">
                    <select id="period-selector" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        <option value="day">Today</option>
                        <option value="week">This Week</option>
                        <option value="month" selected>This Month</option>
                        <option value="year">This Year</option>
                    </select>
                    <button onclick="exportReport()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                        <i class="fas fa-file-csv mr-2"></i> Export
                    </button>
                    <button onclick="printReport()" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                        <i class="fas fa-print mr-2"></i> Print
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-sm text-gray-600">Total</p>
                    <p id="total-businesses" class="text-2xl font-bold text-gray-900">0</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-sm text-gray-600">Compliant</p>
                    <p id="compliant-count" class="text-2xl font-bold text-green-600">0</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-sm text-gray-600">Partial</p>
                    <p id="partial-count" class="text-2xl font-bold text-yellow-600">0</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-sm text-gray-600">Non-Compliant</p>
                    <p id="non-compliant-count" class="text-2xl font-bold text-red-600">0</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-sm text-gray-600">Total Revenue</p>
                    <p id="total-revenue" class="text-xl font-bold text-gray-900">ETB 0</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-sm text-gray-600">Total VAT</p>
                    <p id="total-vat" class="text-xl font-bold text-gray-900">ETB 0</p>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <p class="text-sm text-gray-600">Avg Compliance</p>
                    <p id="overall-compliance" class="text-2xl font-bold text-purple-600">0%</p>
                </div>
            </div>

            <div id="loading-state" class="bg-white rounded-lg shadow p-8 text-center mb-6">
                <i class="fas fa-spinner fa-spin text-4xl text-purple-600 mb-4"></i>
                <p class="text-gray-600">Loading compliance data...</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="bg-white rounded-lg shadow">
                    <div class="px-6 py-4 border-b border-gray-200 bg-green-50">
                        <h3 class="text-lg font-semibold text-green-800">
                            <i class="fas fa-check-circle mr-2"></i>
                            Compliant (≥95%)
                        </h3>
                    </div>
                    <div id="compliant-list" class="p-6 space-y-4"></div>
                </div>

                <div class="bg-white rounded-lg shadow">
                    <div class="px-6 py-4 border-b border-gray-200 bg-yellow-50">
                        <h3 class="text-lg font-semibold text-yellow-800">
                            <i class="fas fa-exclamation-triangle mr-2"></i>
                            Partial (70-94%)
                        </h3>
                    </div>
                    <div id="partial-list" class="p-6 space-y-4"></div>
                </div>

                <div class="bg-white rounded-lg shadow">
                    <div class="px-6 py-4 border-b border-gray-200 bg-red-50">
                        <h3 class="text-lg font-semibold text-red-800">
                            <i class="fas fa-times-circle mr-2"></i>
                            Non-Compliant (<70%)
                        </h3>
                    </div>
                    <div id="non-compliant-list" class="p-6 space-y-4"></div>
                </div>
            </div>
        </div>

        <script src="/static/erca-auth.js"></script>
        <script src="/static/compliance-report.js"></script>
    </body>
    </html>
  `)
})

export default app
