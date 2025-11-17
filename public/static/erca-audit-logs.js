// ERCA Audit Logs Module
// Handles viewing and filtering of audit logs

let auditLogs = []
let currentOfficial = null

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Require super admin authentication
  const isAuth = await ercaAuth.requireAuth()
  if (!isAuth) return

  currentOfficial = ercaAuth.getCurrentOfficial()
  
  // Check if super admin
  if (!ercaAuth.isSuperAdmin()) {
    alert('Access denied. Only Super Admins can view audit logs.')
    window.location.href = '/erca-dashboard'
    return
  }
  
  // Load audit logs
  await loadAuditLogs()
})

// Load audit logs
async function loadAuditLogs(limit = 100) {
  try {
    const response = await axios.get(`/api/erca/admin/audit-logs?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${ercaAuth.getSessionToken()}` }
    })
    
    auditLogs = response.data.logs || []
    renderAuditLogs()
    updateStats()
  } catch (error) {
    console.error('Error loading audit logs:', error)
    showNotification('Error loading audit logs', 'error')
  }
}

// Update statistics
function updateStats() {
  const totalLogs = auditLogs.length
  const uniqueOfficials = new Set(auditLogs.map(log => log.employee_id)).size
  
  // Count actions
  const actionCounts = {}
  auditLogs.forEach(log => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
  })
  
  document.getElementById('total-logs').textContent = totalLogs
  document.getElementById('unique-officials').textContent = uniqueOfficials
  document.getElementById('total-actions').textContent = Object.keys(actionCounts).length
  
  // Most common action
  const mostCommonAction = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])[0]
  
  document.getElementById('common-action').textContent = mostCommonAction 
    ? `${formatActionName(mostCommonAction[0])} (${mostCommonAction[1]})` 
    : 'N/A'
}

// Render audit logs table
function renderAuditLogs() {
  const tbody = document.getElementById('audit-logs-table')
  
  if (auditLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
          No audit logs found
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = auditLogs.map(log => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatDateTime(log.created_at)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div>
          <p class="font-semibold text-gray-900">${log.full_name}</p>
          <p class="text-xs text-gray-500">${log.employee_id} - ${log.rank}</p>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action)}">
          ${formatActionName(log.action)}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        ${log.entity_type || 'N/A'}
      </td>
      <td class="px-6 py-4 text-sm text-gray-700">
        ${log.ip_address || 'N/A'}
      </td>
      <td class="px-6 py-4 text-sm">
        <button onclick="viewLogDetails(${log.id})" 
                class="text-indigo-600 hover:text-indigo-900">
          <i class="fas fa-info-circle"></i> Details
        </button>
      </td>
    </tr>
  `).join('')
}

// Format action name
function formatActionName(action) {
  const names = {
    'login': 'Login',
    'logout': 'Logout',
    'create_user': 'Create User',
    'update_user': 'Update User',
    'view_business': 'View Business',
    'verify_invoice': 'Verify Invoice',
    'generate_report': 'Generate Report'
  }
  return names[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Get action color
function getActionColor(action) {
  const colors = {
    'login': 'bg-green-100 text-green-700',
    'logout': 'bg-gray-100 text-gray-700',
    'create_user': 'bg-blue-100 text-blue-700',
    'update_user': 'bg-yellow-100 text-yellow-700',
    'view_business': 'bg-purple-100 text-purple-700',
    'verify_invoice': 'bg-indigo-100 text-indigo-700',
    'generate_report': 'bg-cyan-100 text-cyan-700'
  }
  return colors[action] || 'bg-gray-100 text-gray-700'
}

// Format date time
function formatDateTime(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// View log details
function viewLogDetails(logId) {
  const log = auditLogs.find(l => l.id === logId)
  if (!log) return
  
  let details = 'No additional details'
  if (log.details) {
    try {
      const parsed = JSON.parse(log.details)
      details = JSON.stringify(parsed, null, 2)
    } catch {
      details = log.details
    }
  }
  
  const message = `Audit Log Details:\n\n` +
    `Time: ${formatDateTime(log.created_at)}\n` +
    `Official: ${log.full_name} (${log.employee_id})\n` +
    `Rank: ${log.rank}\n` +
    `Action: ${formatActionName(log.action)}\n` +
    `Entity Type: ${log.entity_type || 'N/A'}\n` +
    `Entity ID: ${log.entity_id || 'N/A'}\n` +
    `IP Address: ${log.ip_address || 'N/A'}\n\n` +
    `Details:\n${details}`
  
  alert(message)
}

// Filter logs
function filterLogs() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase()
  const actionFilter = document.getElementById('action-filter').value
  const dateFilter = document.getElementById('date-filter').value
  
  let filtered = auditLogs.filter(log => {
    const matchesSearch = 
      log.full_name.toLowerCase().includes(searchTerm) ||
      log.employee_id.toLowerCase().includes(searchTerm) ||
      formatActionName(log.action).toLowerCase().includes(searchTerm)
    
    const matchesAction = !actionFilter || log.action === actionFilter
    
    let matchesDate = true
    if (dateFilter) {
      const logDate = new Date(log.created_at)
      const filterDate = new Date(dateFilter)
      matchesDate = logDate.toDateString() === filterDate.toDateString()
    }
    
    return matchesSearch && matchesAction && matchesDate
  })
  
  // Render filtered logs
  const tbody = document.getElementById('audit-logs-table')
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
          No logs match your filters
        </td>
      </tr>
    `
  } else {
    const temp = auditLogs
    auditLogs = filtered
    renderAuditLogs()
    auditLogs = temp
  }
}

// Export logs to CSV
function exportToCSV() {
  const headers = ['Timestamp', 'Official Name', 'Employee ID', 'Rank', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Details']
  
  const rows = auditLogs.map(log => [
    formatDateTime(log.created_at),
    log.full_name,
    log.employee_id,
    log.rank,
    formatActionName(log.action),
    log.entity_type || '',
    log.entity_id || '',
    log.ip_address || '',
    log.details ? log.details.replace(/"/g, '""') : ''
  ])
  
  let csv = headers.join(',') + '\n'
  rows.forEach(row => {
    csv += row.map(field => `"${field}"`).join(',') + '\n'
  })
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `erca-audit-logs-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
  
  showNotification('Audit logs exported successfully', 'success')
}

// Load more logs
function loadMoreLogs() {
  const currentLimit = parseInt(document.getElementById('limit-select').value)
  loadAuditLogs(currentLimit)
}

// Show notification
function showNotification(message, type = 'info', duration = 5000) {
  const notification = document.createElement('div')
  notification.className = `fixed top-4 right-4 px-6 py-4 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
    'bg-blue-500'
  } text-white`
  
  notification.innerHTML = `
    <div class="flex items-center">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
      <span>${message}</span>
    </div>
  `
  
  document.body.appendChild(notification)
  
  setTimeout(() => {
    notification.remove()
  }, duration)
}
