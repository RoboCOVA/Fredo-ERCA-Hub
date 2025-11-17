// ERCA Business Monitoring Dashboard
// Shows all businesses with real-time transaction data, compliance, and sync status

let currentOfficial = null;
let allBusinesses = [];
let filteredBusinesses = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Business Monitoring Dashboard loading...');
  
  // Get current official
  currentOfficial = ercaAuth.getCurrentOfficial();
  
  if (!currentOfficial) {
    console.error('No official session');
    window.location.href = '/login?redirect=/business-monitoring';
    return;
  }
  
  console.log('Current official:', currentOfficial);
  
  // Load businesses
  await loadBusinesses();
  
  // Set up filter
  document.getElementById('filter-input').addEventListener('input', filterBusinesses);
  document.getElementById('compliance-filter').addEventListener('change', filterBusinesses);
});

// Load all businesses with real-time data
async function loadBusinesses() {
  try {
    showLoading();
    console.log('Loading businesses...');
    
    // Call vPOS API to get all businesses with live data
    const response = await axios.get(
      'https://28df9da6.fredo-vpos.pages.dev/api/erca/businesses/live'
    );
    
    console.log('Businesses response:', response.data);
    
    allBusinesses = response.data.businesses || [];
    filteredBusinesses = [...allBusinesses];
    
    renderBusinesses(filteredBusinesses);
    updateSummaryStats(allBusinesses);
    
  } catch (error) {
    console.error('Error loading businesses:', error);
    showError('Failed to load businesses: ' + (error.response?.data?.error || error.message));
  }
}

// Update summary statistics
function updateSummaryStats(businesses) {
  const totalBusinesses = businesses.length;
  const activeBusinesses = businesses.filter(b => b.erca_sync_enabled).length;
  
  const totalRevenue = businesses.reduce((sum, b) => sum + (b.total_revenue || 0), 0);
  const totalVAT = businesses.reduce((sum, b) => sum + (b.total_vat_collected || 0), 0);
  const totalTransactions = businesses.reduce((sum, b) => sum + (b.total_transactions || 0), 0);
  
  // Calculate average compliance
  const businessesWithTransactions = businesses.filter(b => b.total_transactions > 0);
  const avgCompliance = businessesWithTransactions.length > 0
    ? businessesWithTransactions.reduce((sum, b) => {
        const rate = b.total_transactions > 0 
          ? (b.synced_transactions / b.total_transactions) * 100 
          : 0;
        return sum + rate;
      }, 0) / businessesWithTransactions.length
    : 0;
  
  document.getElementById('total-businesses').textContent = totalBusinesses;
  document.getElementById('active-businesses').textContent = activeBusinesses;
  document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
  document.getElementById('total-vat').textContent = formatCurrency(totalVAT);
  document.getElementById('total-transactions').textContent = totalTransactions.toLocaleString();
  document.getElementById('avg-compliance').textContent = avgCompliance.toFixed(1) + '%';
}

// Render businesses table
function renderBusinesses(businesses) {
  const tbody = document.getElementById('businesses-tbody');
  
  if (!businesses || businesses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>No businesses found</p>
        </td>
      </tr>
    `;
    document.getElementById('loading-state').classList.add('hidden');
    return;
  }
  
  tbody.innerHTML = businesses.map(business => {
    const complianceRate = business.total_transactions > 0
      ? ((business.synced_transactions / business.total_transactions) * 100).toFixed(1)
      : 0;
    
    const complianceBadge = getComplianceBadge(parseFloat(complianceRate));
    const syncStatus = business.erca_sync_enabled 
      ? '<span class="text-green-600"><i class="fas fa-check-circle"></i> Active</span>'
      : '<span class="text-gray-400"><i class="fas fa-times-circle"></i> Inactive</span>';
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="font-medium text-gray-900">${business.business_name}</div>
          <div class="text-sm text-gray-500">${business.city}, ${business.region}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-600">
          ${business.tin}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          ${business.business_type}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
          ${business.total_transactions || 0}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
          ${formatCurrency(business.total_revenue || 0)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
          ${formatCurrency(business.total_vat_collected || 0)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">
          ${complianceBadge}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
          <button 
            onclick="viewBusinessDetails(${business.id}, '${business.tin}')"
            class="text-indigo-600 hover:text-indigo-900 font-semibold"
          >
            <i class="fas fa-eye mr-1"></i> View
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('results-count').textContent = `Showing ${businesses.length} business${businesses.length !== 1 ? 'es' : ''}`;
}

// Filter businesses
function filterBusinesses() {
  const searchTerm = document.getElementById('filter-input').value.toLowerCase();
  const complianceFilter = document.getElementById('compliance-filter').value;
  
  filteredBusinesses = allBusinesses.filter(business => {
    // Text search filter
    const matchesSearch = !searchTerm || 
      business.business_name.toLowerCase().includes(searchTerm) ||
      business.tin.includes(searchTerm) ||
      business.city.toLowerCase().includes(searchTerm) ||
      business.business_type.toLowerCase().includes(searchTerm);
    
    // Compliance filter
    let matchesCompliance = true;
    if (complianceFilter !== 'all' && business.total_transactions > 0) {
      const rate = (business.synced_transactions / business.total_transactions) * 100;
      
      if (complianceFilter === 'compliant' && rate < 95) {
        matchesCompliance = false;
      } else if (complianceFilter === 'partial' && (rate < 70 || rate >= 95)) {
        matchesCompliance = false;
      } else if (complianceFilter === 'non-compliant' && rate >= 70) {
        matchesCompliance = false;
      }
    } else if (complianceFilter !== 'all' && business.total_transactions === 0) {
      matchesCompliance = false;
    }
    
    return matchesSearch && matchesCompliance;
  });
  
  renderBusinesses(filteredBusinesses);
}

// View business details
function viewBusinessDetails(businessId, tin) {
  // Navigate to detailed view (could open modal or new page)
  window.location.href = `/business-details?tin=${tin}`;
}

// Export to CSV
function exportToCSV() {
  const headers = ['Business Name', 'TIN', 'Type', 'City', 'Region', 'Transactions', 'Revenue', 'VAT', 'Compliance Rate'];
  
  const rows = filteredBusinesses.map(b => {
    const complianceRate = b.total_transactions > 0
      ? ((b.synced_transactions / b.total_transactions) * 100).toFixed(1)
      : '0';
    
    return [
      b.business_name,
      b.tin,
      b.business_type,
      b.city,
      b.region,
      b.total_transactions || 0,
      b.total_revenue || 0,
      b.total_vat_collected || 0,
      complianceRate + '%'
    ];
  });
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `erca-businesses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Get compliance badge
function getComplianceBadge(rate) {
  if (rate >= 95) {
    return `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      ${rate}% <i class="fas fa-check-circle ml-1"></i>
    </span>`;
  } else if (rate >= 70) {
    return `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      ${rate}% <i class="fas fa-exclamation-triangle ml-1"></i>
    </span>`;
  } else if (rate > 0) {
    return `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      ${rate}% <i class="fas fa-times-circle ml-1"></i>
    </span>`;
  } else {
    return `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      N/A
    </span>`;
  }
}

// Show loading state
function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
}

// Show error
function showError(message) {
  document.getElementById('loading-state').classList.add('hidden');
  alert('Error: ' + message);
}

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Export functions
window.viewBusinessDetails = viewBusinessDetails;
window.exportToCSV = exportToCSV;
window.filterBusinesses = filterBusinesses;
