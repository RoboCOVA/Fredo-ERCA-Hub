// Fredo ERCA Hub - Comprehensive Analytics Dashboard
// For Ethiopian Revenue and Customs Authority monitoring

let charts = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ERCA Hub Analytics] Initializing dashboard...');
  await loadAnalytics();
});

// Load all analytics data
async function loadAnalytics() {
  try {
    // Load summary stats
    await loadSummaryStats();
    
    // Load regional data
    await loadRegionalRevenue();
    
    // Load business type distribution
    await loadBusinessTypeRevenue();
    
    // Load business size analysis
    await loadBusinessSizeRevenue();
    
    // Load monthly trends
    await loadMonthlyTrends();
    
    // Load top businesses
    await loadTopBusinesses();
    
    // Load compliance alerts
    await loadComplianceAlerts();
    
    console.log('[ERCA Hub Analytics] Dashboard loaded successfully');
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading dashboard:', error);
    alert('Error loading analytics: ' + error.message);
  }
}

// Load summary statistics
async function loadSummaryStats() {
  try {
    // Get all sales data
    const salesResponse = await axios.get('/api/erca/businesses');
    const businessData = salesResponse.data.businesses || [];
    
    // Calculate totals from aggregated business data
    const totalRevenue = businessData.reduce((sum, b) => sum + (b.total_revenue || 0), 0);
    const totalTax = businessData.reduce((sum, b) => sum + (b.total_vat_collected || 0) + (b.total_turnover_tax_collected || 0), 0);
    const totalTransactions = businessData.reduce((sum, b) => sum + (b.total_transactions || 0), 0);
    const activeBusinesses = businessData.length;
    
    // Calculate effective tax rate
    const effectiveTaxRate = totalRevenue > 0 ? (totalTax / totalRevenue * 100).toFixed(1) : 0;
    
    // Update UI
    document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('total-tax').textContent = formatCurrency(totalTax);
    document.getElementById('tax-rate').textContent = `Effective Rate: ${effectiveTaxRate}%`;
    document.getElementById('active-businesses').textContent = activeBusinesses.toLocaleString();
    document.getElementById('total-transactions').textContent = totalTransactions.toLocaleString();
    
    // Compliance rate - calculate from sync status
    // Note: This would need actual sync status from sales data
    const complianceRate = 95; // Placeholder - would calculate from actual data
    document.getElementById('compliance-rate').innerHTML = `<i class="fas fa-check-circle"></i> ${complianceRate}% Synced`;
    
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading summary stats:', error);
  }
}

// Load regional revenue data with interactive heat map
async function loadRegionalRevenue() {
  try {
    const response = await axios.get('/api/erca/analytics/regional-revenue');
    const data = response.data || [];
    
    const regionalList = document.getElementById('regional-list');
    regionalList.innerHTML = '';
    
    if (data.length === 0) {
      regionalList.innerHTML = '<p class="text-gray-500 text-center py-8">No regional data available</p>';
      
      // Initialize empty map
      if (window.EthiopiaMap) {
        new window.EthiopiaMap('ethiopia-interactive-map', {});
      }
      return;
    }
    
    // Sort by revenue
    data.sort((a, b) => b.total_revenue - a.total_revenue);
    
    // Prepare map data
    const mapData = {};
    data.forEach(region => {
      mapData[region.region] = {
        revenue: region.total_revenue,
        businesses: region.num_businesses,
        transactions: region.num_transactions || 0
      };
    });
    
    // Initialize interactive Ethiopia map
    if (window.EthiopiaMap) {
      new window.EthiopiaMap('ethiopia-interactive-map', mapData);
    }
    
    // Get max revenue for heat map coloring
    const maxRevenue = data[0]?.total_revenue || 1;
    
    // Create heat map grid
    const heatMapDiv = document.createElement('div');
    heatMapDiv.className = 'grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6';
    
    // Region name mapping
    const regionNames = {
      'AA': 'Addis Ababa',
      'OR': 'Oromia',
      'AM': 'Amhara',
      'TG': 'Tigray',
      'SN': 'SNNPR',
      'SO': 'Somali',
      'BG': 'Benishangul-Gumuz',
      'AF': 'Afar',
      'GM': 'Gambela',
      'HR': 'Harari',
      'DD': 'Dire Dawa',
      'SD': 'Sidama',
      'SW': 'South West'
    };
    
    // Add Addis Ababa prominently at top
    const aaData = data.find(r => r.region === 'AA');
    if (aaData) {
      const intensity = (aaData.total_revenue / maxRevenue);
      const bgColor = `rgba(147, 51, 234, ${0.2 + intensity * 0.8})`; // Purple theme for ERCA
      
      const aaTile = document.createElement('div');
      aaTile.className = 'col-span-2 sm:col-span-3 p-4 rounded-lg cursor-pointer hover:shadow-lg transition-all border-2 border-purple-300';
      aaTile.style.backgroundColor = bgColor;
      aaTile.innerHTML = `
        <div class="text-center">
          <div class="text-lg font-bold text-white mb-1">⭐ ${regionNames['AA']}</div>
          <div class="text-2xl font-extrabold text-white">${formatCurrency(aaData.total_revenue)}</div>
          <div class="text-xs text-white mt-1">${aaData.num_businesses} businesses • ${aaData.num_transactions || 0} transactions</div>
        </div>
      `;
      aaTile.onclick = () => showRegionDetails(aaData);
      heatMapDiv.appendChild(aaTile);
    }
    
    // Add other regions
    data.filter(r => r.region !== 'AA').forEach(region => {
      const intensity = (region.total_revenue / maxRevenue);
      const bgColor = `rgba(147, 51, 234, ${0.2 + intensity * 0.8})`;
      const textColor = intensity > 0.5 ? 'text-white' : 'text-gray-900';
      
      const tile = document.createElement('div');
      tile.className = 'p-3 rounded-lg cursor-pointer hover:shadow-lg transition-all border border-gray-200';
      tile.style.backgroundColor = bgColor;
      tile.innerHTML = `
        <div class="text-center">
          <div class="text-sm font-bold ${textColor} mb-1">${regionNames[region.region] || region.region}</div>
          <div class="text-lg font-bold ${textColor}">${formatCurrency(region.total_revenue)}</div>
          <div class="text-xs ${textColor} opacity-80 mt-1">${region.num_businesses} biz</div>
        </div>
      `;
      tile.onclick = () => showRegionDetails(region);
      heatMapDiv.appendChild(tile);
    });
    
    regionalList.appendChild(heatMapDiv);
    
    // Add legend
    const legend = document.createElement('div');
    legend.className = 'flex items-center justify-center space-x-4 mt-4 text-xs text-gray-600';
    legend.innerHTML = `
      <span>Revenue Intensity:</span>
      <div class="flex items-center space-x-2">
        <div class="w-8 h-4 rounded" style="background: rgba(147, 51, 234, 0.2)"></div>
        <span>Low</span>
      </div>
      <div class="flex items-center space-x-2">
        <div class="w-8 h-4 rounded" style="background: rgba(147, 51, 234, 0.6)"></div>
        <span>Medium</span>
      </div>
      <div class="flex items-center space-x-2">
        <div class="w-8 h-4 rounded" style="background: rgba(147, 51, 234, 1)"></div>
        <span>High</span>
      </div>
    </div>
    `;
    regionalList.appendChild(legend);
    
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading regional revenue:', error);
    document.getElementById('regional-list').innerHTML = '<p class="text-red-500 text-center py-8">Error loading regional data</p>';
  }
}

// Show detailed region information
function showRegionDetails(region) {
  const regionNames = {
    'AA': 'Addis Ababa', 'OR': 'Oromia', 'AM': 'Amhara', 'TG': 'Tigray',
    'SN': 'SNNPR', 'SO': 'Somali', 'BG': 'Benishangul-Gumuz', 'AF': 'Afar',
    'GM': 'Gambela', 'HR': 'Harari', 'DD': 'Dire Dawa', 'SD': 'Sidama', 'SW': 'South West'
  };
  
  const avgTransactionValue = region.num_transactions > 0 ? 
    region.total_revenue / region.num_transactions : 0;
  
  alert(`📊 ${regionNames[region.region] || region.region} Region\n\n` +
    `💰 Total Revenue: ${formatCurrency(region.total_revenue)}\n` +
    `💵 Tax Collected: ${formatCurrency(region.total_tax || 0)}\n` +
    `🏢 Businesses: ${region.num_businesses}\n` +
    `🛒 Transactions: ${region.num_transactions || 0}\n` +
    `📈 Avg Transaction: ${formatCurrency(avgTransactionValue)}\n\n` +
    `Click on other regions to compare!`);
}

// Load business type revenue distribution
async function loadBusinessTypeRevenue() {
  try {
    const response = await axios.get('/api/erca/analytics/business-type-revenue');
    const data = response.data || [];
    
    if (data.length === 0) {
      return;
    }
    
    const labels = data.map(d => d.category_name || d.business_type);
    const revenues = data.map(d => d.total_revenue);
    
    const ctx = document.getElementById('business-type-chart');
    
    // Destroy existing chart
    if (charts.businessType) {
      charts.businessType.destroy();
    }
    
    charts.businessType = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: revenues,
          backgroundColor: [
            '#9333EA', '#06B6D4', '#10B981', '#F59E0B',
            '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.label + ': ' + formatCurrency(context.parsed);
              }
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading business type revenue:', error);
  }
}

// Load business size revenue analysis
async function loadBusinessSizeRevenue() {
  try {
    const response = await axios.get('/api/erca/analytics/business-size-revenue');
    const data = response.data || [];
    
    if (data.length === 0) {
      return;
    }
    
    // Sort by size order
    const sizeOrder = ['micro', 'small', 'medium', 'large'];
    data.sort((a, b) => sizeOrder.indexOf(a.business_size) - sizeOrder.indexOf(b.business_size));
    
    const labels = data.map(d => d.business_size.charAt(0).toUpperCase() + d.business_size.slice(1));
    const revenues = data.map(d => d.total_revenue);
    const businesses = data.map(d => d.num_businesses);
    
    const ctx = document.getElementById('business-size-chart');
    
    // Destroy existing chart
    if (charts.businessSize) {
      charts.businessSize.destroy();
    }
    
    charts.businessSize = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue',
          data: revenues,
          backgroundColor: '#9333EA',
          yAxisID: 'y'
        }, {
          label: 'Number of Businesses',
          data: businesses,
          backgroundColor: '#10B981',
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Revenue (ETB)'
            }
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Number of Businesses'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading business size revenue:', error);
  }
}

// Load monthly revenue trends
async function loadMonthlyTrends() {
  try {
    // Get aggregated monthly data from ERCA API
    const response = await axios.get('/api/erca/analytics/monthly-trends');
    const data = response.data || [];
    
    if (data.length === 0) {
      return;
    }
    
    const labels = data.map(d => {
      const date = new Date(d.month + '-01');
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    
    const revenues = data.map(d => d.total_revenue);
    const taxes = data.map(d => d.total_tax);
    
    const ctx = document.getElementById('revenue-trend-chart');
    
    // Destroy existing chart
    if (charts.revenueTrend) {
      charts.revenueTrend.destroy();
    }
    
    charts.revenueTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue',
          data: revenues,
          borderColor: '#9333EA',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          fill: true,
          tension: 0.4
        }, {
          label: 'Tax Collected',
          data: taxes,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
              }
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading monthly trends:', error);
  }
}

// Load top performing businesses
async function loadTopBusinesses() {
  try {
    const response = await axios.get('/api/erca/analytics/top-taxpayers?limit=10');
    const businesses = response.data.taxpayers || [];
    
    const tbody = document.getElementById('top-businesses');
    tbody.innerHTML = '';
    
    if (businesses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No business data available</td></tr>';
      return;
    }
    
    businesses.forEach((business, index) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      
      const rankBadge = index < 3 ? 
        `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full ${
          index === 0 ? 'bg-yellow-100 text-yellow-800' :
          index === 1 ? 'bg-gray-100 text-gray-800' :
          'bg-orange-100 text-orange-800'
        } font-bold">${index + 1}</span>` :
        `<span class="text-gray-600 font-semibold">${index + 1}</span>`;
      
      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-center">${rankBadge}</td>
        <td class="px-6 py-4">
          <div class="font-semibold text-gray-900">${business.business_name}</div>
          <div class="text-sm text-gray-500">TIN: ${business.tin}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
            ${business.business_type || 'N/A'}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${business.city || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">${business.transaction_count || 0} txns</td>
        <td class="px-6 py-4 whitespace-nowrap text-right font-semibold text-green-600">${formatCurrency(business.total_tax_collected)}</td>
      `;
      
      tbody.appendChild(row);
    });
    
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading top businesses:', error);
  }
}

// Load compliance alerts
async function loadComplianceAlerts() {
  try {
    const response = await axios.get('/api/erca/compliance/sync-status');
    const businesses = response.data.businesses || [];
    
    let totalSales = 0;
    let totalPending = 0;
    let totalSynced = 0;
    let totalFailed = 0;
    
    businesses.forEach(b => {
      totalSales += b.total_sales || 0;
      totalPending += b.pending_sync || 0;
      totalSynced += b.synced || 0;
      totalFailed += b.failed || 0;
    });
    
    const alertsDiv = document.getElementById('compliance-alerts');
    alertsDiv.innerHTML = '';
    
    if (totalSales === 0) {
      alertsDiv.innerHTML = '<p class="text-gray-600">No sales data available for compliance monitoring.</p>';
      return;
    }
    
    // Synced percentage
    const syncedPercentage = ((totalSynced / totalSales) * 100).toFixed(1);
    alertsDiv.innerHTML += `
      <div class="flex items-center">
        <i class="fas fa-check-circle text-green-600 mr-2"></i>
        <span class="text-green-900 font-medium">${totalSynced.toLocaleString()} of ${totalSales.toLocaleString()} transactions synced with ERCA (${syncedPercentage}%)</span>
      </div>
    `;
    
    if (totalPending > 0) {
      alertsDiv.innerHTML += `
        <div class="flex items-center mt-2">
          <i class="fas fa-clock text-orange-600 mr-2"></i>
          <span class="text-orange-900 font-medium">${totalPending.toLocaleString()} transactions pending synchronization</span>
        </div>
      `;
    }
    
    if (totalFailed > 0) {
      alertsDiv.innerHTML += `
        <div class="flex items-center mt-2">
          <i class="fas fa-times-circle text-red-600 mr-2"></i>
          <span class="text-red-900 font-medium">${totalFailed.toLocaleString()} transactions failed to sync - action required</span>
        </div>
      `;
    }
    
    if (totalPending === 0 && totalFailed === 0 && totalSales > 0) {
      alertsDiv.innerHTML += `
        <div class="flex items-center mt-2">
          <i class="fas fa-shield-alt text-green-600 mr-2"></i>
          <span class="text-green-900 font-medium">All transactions are compliant and synced!</span>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('[ERCA Hub Analytics] Error loading compliance alerts:', error);
  }
}

// Export report
async function exportReport() {
  alert('Report export functionality will be implemented with CSV/Excel generation.');
  // TODO: Implement CSV/Excel export
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-ET', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' ETB';
}
