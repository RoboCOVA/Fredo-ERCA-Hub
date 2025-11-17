// ERCA User Management Module
// Handles user management operations for ERCA officials

let officials = []
let ranks = []
let departments = []
let currentOfficial = null

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Require authentication with user management permission
  const isAuth = await ercaAuth.requireAuth('can_manage_users')
  if (!isAuth) return

  currentOfficial = ercaAuth.getCurrentOfficial()
  
  // Load data
  await Promise.all([
    loadOfficials(),
    loadRanks(),
    loadDepartments()
  ])
})

// Load all officials
async function loadOfficials() {
  try {
    const response = await axios.get('/api/erca/admin/officials', {
      headers: { 'Authorization': `Bearer ${ercaAuth.getSessionToken()}` }
    })
    
    officials = response.data.officials || []
    renderOfficialsTable()
    updateStats()
  } catch (error) {
    console.error('Error loading officials:', error)
    showNotification('Error loading officials', 'error')
  }
}

// Load ranks
async function loadRanks() {
  try {
    const response = await axios.get('/api/erca/admin/ranks')
    ranks = response.data.ranks || []
  } catch (error) {
    console.error('Error loading ranks:', error)
  }
}

// Load departments
async function loadDepartments() {
  try {
    const response = await axios.get('/api/erca/admin/departments')
    departments = response.data.departments || []
  } catch (error) {
    console.error('Error loading departments:', error)
  }
}

// Update statistics
function updateStats() {
  const totalOfficials = officials.length
  const activeOfficials = officials.filter(o => o.is_active).length
  const superAdmins = officials.filter(o => o.is_super_admin).length
  
  document.getElementById('total-officials').textContent = totalOfficials
  document.getElementById('active-officials').textContent = activeOfficials
  document.getElementById('super-admins').textContent = superAdmins
  
  // Count by rank
  const rankCounts = {}
  officials.forEach(o => {
    rankCounts[o.rank_name] = (rankCounts[o.rank_name] || 0) + 1
  })
  
  const rankDistribution = Object.entries(rankCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rank, count]) => `${rank}: ${count}`)
    .join(', ')
  
  document.getElementById('rank-distribution').textContent = rankDistribution || 'N/A'
}

// Render officials table
function renderOfficialsTable() {
  const tbody = document.getElementById('officials-table')
  
  if (officials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-4 text-center text-gray-500">
          No officials found
        </td>
      </tr>
    `
    return
  }
  
  tbody.innerHTML = officials.map(official => `
    <tr class="${!official.is_active ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
          <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
            <span class="text-purple-700 font-bold">${official.full_name.charAt(0)}</span>
          </div>
          <div>
            <p class="font-semibold text-gray-900">${official.full_name}</p>
            <p class="text-xs text-gray-500">${official.employee_id}</p>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <p class="text-sm text-gray-900">${official.email}</p>
        <p class="text-xs text-gray-500">${official.phone}</p>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${getRankColor(official.rank_level)}">
          ${official.rank_name}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        ${official.department || 'N/A'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        ${official.region || 'N/A'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 rounded-full text-xs font-semibold ${
          official.is_active 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }">
          ${official.is_active ? 'Active' : 'Inactive'}
        </span>
        ${official.is_super_admin ? '<span class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">Super Admin</span>' : ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm">
        <button onclick="viewOfficial(${official.id})" 
                class="text-indigo-600 hover:text-indigo-900 mr-3" title="View">
          <i class="fas fa-eye"></i>
        </button>
        <button onclick="editOfficial(${official.id})" 
                class="text-blue-600 hover:text-blue-900 mr-3" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="toggleActive(${official.id})" 
                class="text-${official.is_active ? 'red' : 'green'}-600 hover:text-${official.is_active ? 'red' : 'green'}-900" 
                title="${official.is_active ? 'Deactivate' : 'Activate'}">
          <i class="fas fa-${official.is_active ? 'ban' : 'check-circle'}"></i>
        </button>
      </td>
    </tr>
  `).join('')
}

// Get rank color based on level
function getRankColor(level) {
  const colors = {
    1: 'bg-purple-100 text-purple-700',
    2: 'bg-indigo-100 text-indigo-700',
    3: 'bg-blue-100 text-blue-700',
    4: 'bg-cyan-100 text-cyan-700',
    5: 'bg-teal-100 text-teal-700',
    6: 'bg-green-100 text-green-700',
    7: 'bg-yellow-100 text-yellow-700',
    8: 'bg-orange-100 text-orange-700',
    9: 'bg-gray-100 text-gray-700'
  }
  return colors[level] || 'bg-gray-100 text-gray-700'
}

// Open add official modal
function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add New ERCA Official'
  document.getElementById('official-form').reset()
  document.getElementById('official-id').value = ''
  
  // Populate rank dropdown
  const rankSelect = document.getElementById('official-rank')
  rankSelect.innerHTML = ranks.map(rank => 
    `<option value="${rank.rank_code}">${rank.rank_name}</option>`
  ).join('')
  
  // Populate department dropdown
  const deptSelect = document.getElementById('official-department')
  deptSelect.innerHTML = '<option value="">Select Department</option>' + 
    departments.map(dept => 
      `<option value="${dept.department_name}">${dept.department_name}</option>`
    ).join('')
  
  document.getElementById('official-modal').classList.remove('hidden')
}

// Close modal
function closeModal() {
  document.getElementById('official-modal').classList.add('hidden')
}

// Save official (create or update)
async function saveOfficial(e) {
  e.preventDefault()
  
  const officialId = document.getElementById('official-id').value
  const officialData = {
    full_name: document.getElementById('official-full-name').value,
    employee_id: document.getElementById('official-employee-id').value,
    email: document.getElementById('official-email').value,
    phone: document.getElementById('official-phone').value,
    rank: document.getElementById('official-rank').value,
    department: document.getElementById('official-department').value || null,
    region: document.getElementById('official-region').value || null,
    office_location: document.getElementById('official-office').value || null
  }
  
  try {
    if (officialId) {
      // Update
      await axios.put(`/api/erca/admin/officials/${officialId}`, officialData, {
        headers: { 'Authorization': `Bearer ${ercaAuth.getSessionToken()}` }
      })
      showNotification('Official updated successfully', 'success')
    } else {
      // Create
      const response = await axios.post('/api/erca/admin/officials', officialData, {
        headers: { 'Authorization': `Bearer ${ercaAuth.getSessionToken()}` }
      })
      
      if (response.data.default_password) {
        showNotification(
          `Official created successfully! Default password: ${response.data.default_password}`, 
          'success',
          10000
        )
      } else {
        showNotification('Official created successfully', 'success')
      }
    }
    
    closeModal()
    await loadOfficials()
  } catch (error) {
    console.error('Error saving official:', error)
    showNotification(
      error.response?.data?.error || 'Error saving official', 
      'error'
    )
  }
}

// View official details
function viewOfficial(id) {
  const official = officials.find(o => o.id === id)
  if (!official) return
  
  alert(`Official Details:\n\n` +
    `Name: ${official.full_name}\n` +
    `Employee ID: ${official.employee_id}\n` +
    `Email: ${official.email}\n` +
    `Phone: ${official.phone}\n` +
    `Rank: ${official.rank_name}\n` +
    `Department: ${official.department || 'N/A'}\n` +
    `Region: ${official.region || 'N/A'}\n` +
    `Office: ${official.office_location || 'N/A'}\n` +
    `Status: ${official.is_active ? 'Active' : 'Inactive'}\n` +
    `Super Admin: ${official.is_super_admin ? 'Yes' : 'No'}\n` +
    `Last Login: ${official.last_login_at ? new Date(official.last_login_at).toLocaleString() : 'Never'}`)
}

// Edit official
function editOfficial(id) {
  const official = officials.find(o => o.id === id)
  if (!official) return
  
  document.getElementById('modal-title').textContent = 'Edit ERCA Official'
  document.getElementById('official-id').value = official.id
  document.getElementById('official-full-name').value = official.full_name
  document.getElementById('official-employee-id').value = official.employee_id
  document.getElementById('official-employee-id').disabled = true // Can't change employee ID
  document.getElementById('official-email').value = official.email
  document.getElementById('official-phone').value = official.phone
  document.getElementById('official-rank').value = official.rank
  document.getElementById('official-department').value = official.department || ''
  document.getElementById('official-region').value = official.region || ''
  document.getElementById('official-office').value = official.office_location || ''
  
  document.getElementById('official-modal').classList.remove('hidden')
}

// Toggle active status
async function toggleActive(id) {
  const official = officials.find(o => o.id === id)
  if (!official) return
  
  const action = official.is_active ? 'deactivate' : 'activate'
  
  if (!confirm(`Are you sure you want to ${action} this official?`)) {
    return
  }
  
  try {
    await axios.put(`/api/erca/admin/officials/${id}`, {
      is_active: official.is_active ? 0 : 1
    }, {
      headers: { 'Authorization': `Bearer ${ercaAuth.getSessionToken()}` }
    })
    
    showNotification(`Official ${action}d successfully`, 'success')
    await loadOfficials()
  } catch (error) {
    console.error('Error toggling status:', error)
    showNotification('Error updating status', 'error')
  }
}

// Filter officials
function filterOfficials() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase()
  const rankFilter = document.getElementById('rank-filter').value
  const statusFilter = document.getElementById('status-filter').value
  
  const filtered = officials.filter(official => {
    const matchesSearch = 
      official.full_name.toLowerCase().includes(searchTerm) ||
      official.employee_id.toLowerCase().includes(searchTerm) ||
      official.email.toLowerCase().includes(searchTerm)
    
    const matchesRank = !rankFilter || official.rank === rankFilter
    const matchesStatus = !statusFilter || 
      (statusFilter === 'active' && official.is_active) ||
      (statusFilter === 'inactive' && !official.is_active)
    
    return matchesSearch && matchesRank && matchesStatus
  })
  
  const tbody = document.getElementById('officials-table')
  
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-4 text-center text-gray-500">
          No officials match your filters
        </td>
      </tr>
    `
  } else {
    // Render filtered officials (reuse the render logic)
    const temp = officials
    officials = filtered
    renderOfficialsTable()
    officials = temp
  }
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
