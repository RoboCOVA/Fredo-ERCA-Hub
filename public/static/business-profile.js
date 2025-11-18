// ERCA Business Profile Page
// Displays detailed information about a specific business

let currentOfficial = null;
let businessData = null;
let activityChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Business Profile page loading...');
  
  // Get current official
  currentOfficial = ercaAuth.getCurrentOfficial();
  
  if (!currentOfficial) {
    console.error('No official session');
    window.location.href = '/erca-login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return;
  }
  
  console.log('Current official:', currentOfficial);
  
  // Get TIN from URL
  const urlParams = new URLSearchParams(window.location.search);
  const tin = urlParams.get('tin');
  
  if (!tin) {
    showError('No business TIN provided');
    return;
  }
  
  // Load business profile
  await loadBusinessProfile(tin);
});

// Load business profile data
async function loadBusinessProfile(tin) {
  try {
    showLoading();
    console.log('Loading business profile for TIN:', tin);
    
    // Call ERCA Hub API to get business details
    const response = await axios.get(
      `/api/erca/businesses/${tin}`
    );
    
    console.log('Business profile response:', response.data);
    
    businessData = response.data;
    
    // Render all data
    renderBusinessHeader(businessData.business);
    renderStatistics(businessData.business);
    renderOverviewTab(businessData.business);
    renderContactTab(businessData.business);
    renderTaxTab(businessData.business);
    renderActivityTab(businessData.recentTransactions, businessData.monthlyTrend);
    
    // Show content
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('profile-content').classList.remove('hidden');
    
  } catch (error) {
    console.error('Error loading business profile:', error);
    showError('Failed to load business profile: ' + (error.response?.data?.error || error.message));
  }
}

// Render business header
function renderBusinessHeader(business) {
  document.getElementById('business-name').textContent = business.business_name;
  document.getElementById('business-subtitle').textContent = `TIN: ${business.tin} • ${business.city}, ${business.region || 'Ethiopia'}`;
  
  // Sync status badge
  const syncBadge = business.erca_sync_enabled
    ? `<div class="flex items-center space-x-2">
         <span class="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold">
           <i class="fas fa-check-circle mr-1"></i> ERCA Sync Active
         </span>
       </div>`
    : `<div class="flex items-center space-x-2">
         <span class="bg-gray-100 text-gray-800 px-4 py-2 rounded-full text-sm font-semibold">
           <i class="fas fa-times-circle mr-1"></i> ERCA Sync Inactive
         </span>
       </div>`;
  
  document.getElementById('sync-status-badge').innerHTML = syncBadge;
}

// Render key statistics
function renderStatistics(business) {
  document.getElementById('stat-transactions').textContent = (business.total_transactions || 0).toLocaleString();
  document.getElementById('stat-revenue').textContent = formatCurrency(business.total_revenue || 0);
  document.getElementById('stat-vat').textContent = formatCurrency(business.total_vat_collected || 0);
  
  const complianceRate = business.total_transactions > 0
    ? ((business.synced_transactions / business.total_transactions) * 100).toFixed(1)
    : 0;
  document.getElementById('stat-compliance').textContent = complianceRate + '%';
}

// Render overview tab
function renderOverviewTab(business) {
  document.getElementById('info-tin').textContent = business.tin || 'N/A';
  document.getElementById('info-type').textContent = business.business_type || 'N/A';
  document.getElementById('info-size').textContent = formatBusinessSize(business.business_size);
  document.getElementById('info-employees').textContent = business.num_employees || 'N/A';
  document.getElementById('info-license').textContent = business.trade_license_number || 'N/A';
  document.getElementById('info-registered').textContent = formatDate(business.created_at);
  document.getElementById('info-hours').textContent = business.operating_hours || 'Not specified';
  
  // Subscription status
  const subscriptionBadge = business.subscription_status === 'active'
    ? `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
         <i class="fas fa-check-circle mr-1"></i> Active (${business.subscription_tier || 'Basic'})
       </span>`
    : `<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
         <i class="fas fa-times-circle mr-1"></i> ${business.subscription_status || 'Unknown'}
       </span>`;
  
  document.getElementById('info-subscription').innerHTML = subscriptionBadge;
}

// Render contact tab
function renderContactTab(business) {
  document.getElementById('contact-phone').textContent = business.phone || 'N/A';
  document.getElementById('contact-email').textContent = business.email || 'N/A';
  document.getElementById('contact-region').textContent = business.region || 'N/A';
  document.getElementById('contact-city').textContent = business.city || 'N/A';
  document.getElementById('contact-subcity').textContent = business.sub_city || 'N/A';
  document.getElementById('contact-kebele').textContent = business.kebele || 'N/A';
  document.getElementById('contact-street').textContent = business.street_address || 'N/A';
  
  // Build full address
  const addressParts = [
    business.street_address,
    business.kebele ? `Kebele ${business.kebele}` : null,
    business.sub_city,
    business.city,
    business.region
  ].filter(part => part && part !== 'N/A');
  
  document.getElementById('contact-full').textContent = addressParts.length > 0
    ? addressParts.join(', ')
    : 'Address not available';
}

// Render tax tab
function renderTaxTab(business) {
  document.getElementById('tax-type').textContent = business.tax_type?.toUpperCase() || 'N/A';
  document.getElementById('tax-vat-rate').textContent = business.vat_rate
    ? `${(business.vat_rate * 100).toFixed(0)}%`
    : 'N/A';
  document.getElementById('tax-turnover-rate').textContent = business.turnover_tax_rate
    ? `${(business.turnover_tax_rate * 100).toFixed(0)}%`
    : 'N/A';
  
  // ERCA sync status
  const syncStatus = business.erca_sync_enabled
    ? `<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
         <i class="fas fa-check-circle mr-1"></i> Enabled
       </span>`
    : `<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
         <i class="fas fa-times-circle mr-1"></i> Disabled
       </span>`;
  
  document.getElementById('tax-sync-status').innerHTML = syncStatus;
  
  // Total tax collected
  const totalTax = (business.total_vat_collected || 0) +
                   (business.total_turnover_tax_collected || 0) +
                   (business.total_excise_tax_collected || 0);
  
  document.getElementById('tax-total-collected').textContent = formatCurrency(totalTax);
  document.getElementById('tax-synced').textContent = (business.synced_transactions || 0).toLocaleString();
  document.getElementById('tax-pending').textContent = (business.pending_transactions || 0).toLocaleString();
}

// Render activity tab
function renderActivityTab(transactions, monthlyTrend) {
  // Render chart
  renderActivityChart(monthlyTrend);
  
  // Render recent transactions table
  const tbody = document.getElementById('recent-transactions');
  
  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-4 text-center text-gray-500">
          No transactions found
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = transactions.map(t => {
    const syncStatusBadge = t.erca_sync_status === 'synced'
      ? '<span class="text-green-600"><i class="fas fa-check-circle"></i> Synced</span>'
      : t.erca_sync_status === 'pending'
      ? '<span class="text-yellow-600"><i class="fas fa-clock"></i> Pending</span>'
      : '<span class="text-gray-400"><i class="fas fa-minus-circle"></i> Not Synced</span>';
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${formatDate(t.sale_date)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-600">
          ${t.invoice_number}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
          ${formatCurrency(t.total_amount)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
          ${formatCurrency(t.vat_amount || 0)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">
          ${syncStatusBadge}
        </td>
      </tr>
    `;
  }).join('');
}

// Render activity chart
function renderActivityChart(monthlyTrend) {
  if (!monthlyTrend || monthlyTrend.length === 0) {
    return;
  }
  
  const ctx = document.getElementById('activity-chart').getContext('2d');
  
  // Destroy existing chart if any
  if (activityChart) {
    activityChart.destroy();
  }
  
  // Reverse to show oldest first
  const reversedTrend = [...monthlyTrend].reverse();
  
  activityChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: reversedTrend.map(d => {
        const [year, month] = d.month.split('-');
        const date = new Date(year, parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }),
      datasets: [
        {
          label: 'Revenue',
          data: reversedTrend.map(d => d.revenue),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'VAT Collected',
          data: reversedTrend.map(d => d.vat_collected),
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 2,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: 'Monthly Revenue & VAT Trend (Last 6 Months)'
        },
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += formatCurrency(context.parsed.y);
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: {
            callback: function(value) {
              return 'ETB ' + value.toLocaleString();
            }
          }
        }
      }
    }
  });
}

// Tab switching
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-blue-500', 'text-blue-600');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  
  document.getElementById(`tab-${tabName}`).classList.remove('border-transparent', 'text-gray-500');
  document.getElementById(`tab-${tabName}`).classList.add('border-blue-500', 'text-blue-600');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  document.getElementById(`content-${tabName}`).classList.remove('hidden');
}

// Utility functions
function formatCurrency(amount) {
  return 'ETB ' + (amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatBusinessSize(size) {
  const sizeMap = {
    'micro': 'Micro',
    'small': 'Small',
    'medium': 'Medium',
    'large': 'Large'
  };
  return sizeMap[size] || size || 'N/A';
}

function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('profile-content').classList.add('hidden');
}

function showError(message) {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('error-state').classList.remove('hidden');
  document.getElementById('profile-content').classList.add('hidden');
  document.getElementById('error-message').textContent = message;
}

// Export for use in HTML
window.switchTab = switchTab;
