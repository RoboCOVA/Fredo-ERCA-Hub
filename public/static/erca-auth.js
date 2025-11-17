// ERCA Authentication Module
// Handles authentication for ERCA government officials

class ERCAAuth {
  constructor() {
    this.currentOfficial = null
    this.sessionToken = null
    this.loadSession()
  }

  // Load session from localStorage
  loadSession() {
    const sessionData = localStorage.getItem('erca_session')
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData)
        if (session.expires_at && new Date(session.expires_at) > new Date()) {
          this.currentOfficial = session.official
          this.sessionToken = session.session_token
          return true
        } else {
          this.clearSession()
        }
      } catch (error) {
        console.error('Error loading session:', error)
        this.clearSession()
      }
    }
    return false
  }

  // Save session to localStorage
  saveSession(official, token, expiresAt) {
    const session = {
      official,
      session_token: token,
      expires_at: expiresAt
    }
    localStorage.setItem('erca_session', JSON.stringify(session))
    this.currentOfficial = official
    this.sessionToken = token
  }

  // Clear session
  clearSession() {
    localStorage.removeItem('erca_session')
    this.currentOfficial = null
    this.sessionToken = null
  }

  // Check if user is logged in
  isLoggedIn() {
    return this.currentOfficial !== null && this.sessionToken !== null
  }

  // Get current official
  getCurrentOfficial() {
    return this.currentOfficial
  }

  // Get session token
  getSessionToken() {
    return this.sessionToken
  }

  // Hash password using SHA-256
  async hashPassword(password) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  // Login official
  async login(employeeId, password) {
    try {
      const response = await axios.post('/api/erca/auth/login', {
        employee_id: employeeId,
        password: password
      })

      if (response.data.success) {
        const { official, session_token, expires_at } = response.data
        this.saveSession(official, session_token, expires_at)
        return { success: true, official }
      }

      return { success: false, error: response.data.error || 'Login failed' }
    } catch (error) {
      console.error('Login error:', error)
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Login failed' 
      }
    }
  }

  // Validate session
  async validateSession() {
    try {
      if (!this.sessionToken) {
        return false
      }

      const response = await axios.post('/api/erca/auth/validate', {
        session_token: this.sessionToken
      })

      if (!response.data.valid) {
        this.clearSession()
        return false
      }

      return true
    } catch (error) {
      console.error('Session validation error:', error)
      this.clearSession()
      return false
    }
  }

  // Logout official
  async logout() {
    try {
      if (this.sessionToken) {
        await axios.post('/api/erca/auth/logout', {
          session_token: this.sessionToken
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      this.clearSession()
      window.location.href = '/erca-login'
    }
  }

  // Require authentication (redirect if not logged in)
  async requireAuth(requiredPermission = null) {
    const isValid = await this.validateSession()
    
    if (!isValid || !this.isLoggedIn()) {
      window.location.href = '/erca-login?redirect=' + encodeURIComponent(window.location.pathname)
      return false
    }

    // Check permission if specified
    if (requiredPermission) {
      const permissions = this.currentOfficial.permissions
      if (!permissions[requiredPermission]) {
        alert('You do not have permission to access this page.')
        window.location.href = '/erca-dashboard'
        return false
      }
    }

    return true
  }

  // Check if current official has permission
  hasPermission(permission) {
    if (!this.currentOfficial || !this.currentOfficial.permissions) {
      return false
    }
    return this.currentOfficial.permissions[permission] === 1
  }

  // Check if current official is super admin
  isSuperAdmin() {
    return this.currentOfficial && this.currentOfficial.is_super_admin === 1
  }

  // Get rank name
  getRankName() {
    return this.currentOfficial ? this.currentOfficial.rank_name : 'Unknown'
  }

  // Get department
  getDepartment() {
    return this.currentOfficial ? this.currentOfficial.department : 'Unknown'
  }
}

// Create global instance
const ercaAuth = new ERCAAuth()
window.ercaAuth = ercaAuth
