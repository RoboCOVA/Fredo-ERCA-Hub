// ERCA Compliance Report
// Categorizes businesses by compliance rates and generates reports

let currentOfficial = null;
let reportData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Compliance Report loading...');
  
  // Get current official
  currentOfficial = ercaAuth.getCurrentOfficial();
  
  if (!currentOfficial) {
    console.error('No official session');
    window.location.href = '/login?redirect=/compliance-report';
    return;
  }
  
  // Set up period selector
  document.getElementById('period-selector').addEventListener('change', loadComplianceReport);
  
  // Load initial report
  await loadComplianceReport();
});

// Load compliance report
async function loadComplianceReport() {
  try {
    showLoading();
    const period = document.getElementById('period-selector').value;
    console.log('Loading compliance report for period:', period);
    
    // Call vPOS API for compliance report
    const response = await axios.get(
      `https://28df9da6.fredo-vpos.pages.dev/api/erca/compliance-report?period=${period}`
    );
    
    console.log('Compliance report response:', response.data);
    
    reportData = response.data;
    
    updateSummaryCards(reportData.summary);
    renderComplianceCategories(reportData.businesses);
    
  } catch (error) {
    console.error('Error loading compliance report:', error);
    showError('Failed to load compliance report: ' + (error.response?.data?.error || error.message));
  }
}

// Update summary cards
function updateSummaryCards(summary) {
  document.getElementById('total-businesses').textContent = summary.total_businesses || 0;
  document.getElementById('compliant-count').textContent = summary.compliant_businesses || 0;
  document.getElementById('partial-count').textContent = summary.partially_compliant || 0;
  document.getElementById('non-compliant-count').textContent = summary.non_compliant || 0;
  document.getElementById('total-revenue').textContent = formatCurrency(summary.total_revenue || 0);
  document.getElementById('total-vat').textContent = formatCurrency(summary.total_vat || 0);
  document.getElementById('overall-compliance').textContent = (summary.overall_compliance || 0).toFixed(1) + '%';
}

// Render compliance categories
function renderComplianceCategories(businesses) {
  if (!businesses || businesses.length === 0) {
    document.getElementById('compliant-list').innerHTML = getEmptyState('No businesses in this category');
    document.getElementById('partial-list').innerHTML = getEmptyState('No businesses in this category');
    document.getElementById('non-compliant-list').innerHTML = getEmptyState('No businesses in this category');
    document.getElementById('loading-state').classList.add('hidden');
    return;
  }
  
  // Categorize businesses
  const compliant = businesses.filter(b => b.compliance_rate >= 95);
  const partial = businesses.filter(b => b.compliance_rate >= 70 && b.compliance_rate < 95);
  const nonCompliant = businesses.filter(b => b.compliance_rate < 70);
  
  // Render each category
  document.getElementById('compliant-list').innerHTML = renderBusinessList(compliant, 'green');
  document.getElementById('partial-list').innerHTML = renderBusinessList(partial, 'yellow');
  document.getElementById('non-compliant-list').innerHTML = renderBusinessList(nonCompliant, 'red');
  
  document.getElementById('loading-state').classList.add('hidden');
}

// Render business list for a category
function renderBusinessList(businesses, colorScheme) {
  if (!businesses || businesses.length === 0) {
    return getEmptyState('No businesses in this category');
  }
  
  const colorClasses = {
    'green': 'border-green-200 hover:bg-green-50',
    'yellow': 'border-yellow-200 hover:bg-yellow-50',
    'red': 'border-red-200 hover:bg-red-50'
  };
  
  return businesses.map(business => `
    <div class="border ${colorClasses[colorScheme]} rounded-lg p-4 transition">
      <div class="flex justify-between items-start mb-2">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900">${business.business_name}</h4>
          <p class="text-sm text-gray-600">${business.city}, ${business.region}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-${colorScheme}-100 text-${colorScheme}-700">
          ${business.compliance_rate.toFixed(1)}%
        </span>
      </div>
      
      <div class="grid grid-cols-2 gap-4 text-sm mt-3">
        <div>
          <p class="text-gray-600">TIN</p>
          <p class="font-mono font-semibold text-indigo-600">${business.tin}</p>
        </div>
        <div>
          <p class="text-gray-600">Type</p>
          <p class="font-semibold">${business.business_type}</p>
        </div>
        <div>
          <p class="text-gray-600">Transactions</p>
          <p class="font-semibold">${business.total_transactions || 0}</p>
        </div>
        <div>
          <p class="text-gray-600">Revenue</p>
          <p class="font-semibold">${formatCurrency(business.total_revenue || 0)}</p>
        </div>
        <div>
          <p class="text-gray-600">Synced</p>
          <p class="font-semibold text-green-600">${business.synced_count || 0}</p>
        </div>
        <div>
          <p class="text-gray-600">Pending</p>
          <p class="font-semibold text-yellow-600">${business.pending_count || 0}</p>
        </div>
      </div>
    </div>
  `).join('');
}

// Get empty state HTML
function getEmptyState(message) {
  return `
    <div class="text-center py-8 text-gray-500">
      <i class="fas fa-inbox text-3xl mb-2"></i>
      <p>${message}</p>
    </div>
  `;
}

// Export compliance report to CSV
function exportReport() {
  if (!reportData || !reportData.businesses) {
    alert('No data to export');
    return;
  }
  
  const period = document.getElementById('period-selector').value;
  const headers = ['Business Name', 'TIN', 'Type', 'City', 'Region', 'Compliance Rate', 'Transactions', 'Synced', 'Pending', 'Failed', 'Revenue', 'VAT'];
  
  const rows = reportData.businesses.map(b => [
    b.business_name,
    b.tin,
    b.business_type,
    b.city,
    b.region,
    b.compliance_rate.toFixed(1) + '%',
    b.total_transactions || 0,
    b.synced_count || 0,
    b.pending_count || 0,
    b.failed_count || 0,
    b.total_revenue || 0,
    b.total_vat || 0
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `erca-compliance-report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Print report
function printReport() {
  window.print();
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
window.exportReport = exportReport;
window.printReport = printReport;
