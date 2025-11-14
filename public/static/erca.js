// Fredo TaxPOS - ERCA Revenue Hub Frontend
// Government Dashboard JavaScript

let taxTrendChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadERCADashboard();
});

// Load ERCA dashboard data
async function loadERCADashboard() {
  const period = document.getElementById('period-select').value;
  
  try {
    // Load national tax summary
    const summaryResponse = await axios.get(`/api/erca/tax-summary?period=${period}`);
    const data = summaryResponse.data;
    
    // Update summary cards
    updateSummaryCards(data.summary);
    
    // Update tax trend chart
    updateTaxTrendChart(data.daily_trend);
    
    // Load businesses table
    loadBusinessesTable();
    
  } catch (error) {
    console.error('Error loading ERCA dashboard:', error);
    alert('Error loading dashboard data');
  }
}

// Update summary cards
function updateSummaryCards(summary) {
  document.getElementById('active-businesses').textContent = summary.active_businesses || 0;
  document.getElementById('total-tax').textContent = formatCurrency(summary.total_tax_collected || 0);
  document.getElementById('total-trans').textContent = summary.total_transactions || 0;
  document.getElementById('total-revenue-erca').textContent = formatCurrency(summary.total_revenue || 0);
}

// Update tax collection trend chart
function updateTaxTrendChart(dailyTrend) {
  const ctx = document.getElementById('tax-trend-chart').getContext('2d');
  
  // Destroy existing chart
  if (taxTrendChart) {
    taxTrendChart.destroy();
  }
  
  const labels = dailyTrend.map(day => formatDateShort(day.date)).reverse();
  const data = dailyTrend.map(day => day.tax_collected).reverse();
  
  taxTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Tax Collection (ETB)',
        data: data,
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Tax Collected: ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        }
      }
    }
  });
}

// Load businesses table
async function loadBusinessesTable() {
  try {
    const response = await axios.get('/api/erca/businesses');
    const businesses = response.data.businesses;
    
    const tbody = document.getElementById('businesses-table');
    
    if (businesses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No businesses registered</td></tr>';
      return;
    }
    
    tbody.innerHTML = businesses.map(business => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${business.tin}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${business.business_name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${business.city}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
            ${capitalizeFirst(business.business_type)}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${business.total_transactions}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
          ${formatCurrency(business.total_revenue)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
          ${formatCurrency(business.total_vat_collected)}
        </td>
      </tr>
    `).join('');
    
  } catch (error) {
    console.error('Error loading businesses:', error);
  }
}

// Verify invoice
async function verifyInvoice() {
  const invoiceNumber = document.getElementById('invoice-search').value.trim();
  const resultDiv = document.getElementById('verification-result');
  
  if (!invoiceNumber) {
    resultDiv.innerHTML = '<p class="text-red-500 text-sm">Please enter an invoice number</p>';
    return;
  }
  
  resultDiv.innerHTML = '<p class="text-gray-500 text-sm">Verifying...</p>';
  
  try {
    const response = await axios.get(`/api/erca/verify-invoice/${invoiceNumber}`);
    const data = response.data;
    
    if (data.verified) {
      resultDiv.innerHTML = `
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center mb-4">
            <i class="fas fa-check-circle text-green-600 text-3xl mr-3"></i>
            <div>
              <h4 class="font-bold text-green-900 text-lg">Invoice Verified ✓</h4>
              <p class="text-sm text-green-700">This is a legitimate invoice registered with ERCA</p>
            </div>
          </div>
          
          <div class="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-600">Business Name:</p>
              <p class="font-semibold text-gray-900">${data.sale.business_name}</p>
            </div>
            <div>
              <p class="text-gray-600">TIN:</p>
              <p class="font-semibold text-gray-900">${data.sale.tin}</p>
            </div>
            <div>
              <p class="text-gray-600">Invoice Number:</p>
              <p class="font-semibold text-gray-900">${data.sale.invoice_number}</p>
            </div>
            <div>
              <p class="text-gray-600">Date:</p>
              <p class="font-semibold text-gray-900">${formatDate(data.sale.sale_date)}</p>
            </div>
            <div>
              <p class="text-gray-600">Subtotal:</p>
              <p class="font-semibold text-gray-900">${formatCurrency(data.sale.subtotal)}</p>
            </div>
            <div>
              <p class="text-gray-600">VAT:</p>
              <p class="font-semibold text-gray-900">${formatCurrency(data.sale.vat_amount)}</p>
            </div>
            <div>
              <p class="text-gray-600">Total Amount:</p>
              <p class="font-semibold text-green-600 text-lg">${formatCurrency(data.sale.total_amount)}</p>
            </div>
            <div>
              <p class="text-gray-600">Payment Method:</p>
              <p class="font-semibold text-gray-900">${capitalizeFirst(data.sale.payment_method)}</p>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t">
            <p class="text-gray-600 font-semibold mb-2">Items Purchased:</p>
            <div class="space-y-1">
              ${data.items.map(item => `
                <div class="flex justify-between text-sm">
                  <span>${item.product_name} × ${item.quantity}</span>
                  <span class="font-semibold">${formatCurrency(item.line_total)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center">
            <i class="fas fa-times-circle text-red-600 text-3xl mr-3"></i>
            <div>
              <h4 class="font-bold text-red-900 text-lg">Invoice Not Found ✗</h4>
              <p class="text-sm text-red-700">This invoice is not registered in ERCA database</p>
            </div>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Error verifying invoice:', error);
    resultDiv.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center">
          <i class="fas fa-exclamation-triangle text-red-600 text-3xl mr-3"></i>
          <div>
            <h4 class="font-bold text-red-900 text-lg">Verification Failed</h4>
            <p class="text-sm text-red-700">${error.response?.data?.message || 'Error verifying invoice'}</p>
          </div>
        </div>
      </div>
    `;
  }
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' ETB';
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Format date short
function formatDateShort(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

// Capitalize first letter
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
}
