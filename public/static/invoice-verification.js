// ERCA Invoice Verification
// Allows ERCA officials to verify invoices by invoice number

let currentOfficial = null;
let currentInvoice = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('Invoice Verification page loading...');
  
  // Get current official
  currentOfficial = ercaAuth.getCurrentOfficial();
  
  if (!currentOfficial) {
    console.error('No official session');
    window.location.href = '/login?redirect=/verify-invoice';
    return;
  }
  
  console.log('Current official:', currentOfficial);
  
  // Set up search form
  document.getElementById('verify-form').addEventListener('submit', handleVerification);
  
  // Set up enter key on input
  document.getElementById('invoice-number').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerification(e);
    }
  });
});

// Handle invoice verification
async function handleVerification(e) {
  e.preventDefault();
  
  const invoiceNumber = document.getElementById('invoice-number').value.trim();
  
  if (!invoiceNumber) {
    showError('Please enter an invoice number');
    return;
  }
  
  // Show loading state
  showLoading();
  
  try {
    console.log('Verifying invoice:', invoiceNumber);
    
    // Call vPOS API for invoice verification
    const response = await axios.get(
      `https://9115feb4.fredo-vpos.pages.dev/api/erca/verify-invoice/${invoiceNumber}`
    );
    
    console.log('Verification response:', response.data);
    
    if (response.data.verified) {
      currentInvoice = response.data.invoice;
      displayInvoice(currentInvoice);
      
      // Log audit trail
      await logAudit('verify_invoice', 'invoice', invoiceNumber);
    } else {
      showError(response.data.error || 'Invoice not found');
    }
    
  } catch (error) {
    console.error('Verification error:', error);
    showError('Failed to verify invoice: ' + (error.response?.data?.error || error.message));
  }
}

// Display verified invoice
function displayInvoice(invoice) {
  const resultsDiv = document.getElementById('verification-results');
  const loadingDiv = document.getElementById('loading-state');
  const errorDiv = document.getElementById('error-state');
  
  loadingDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  resultsDiv.classList.remove('hidden');
  
  // Sync status badge
  const syncStatusBadge = getSyncStatusBadge(invoice.erca_sync_status);
  
  // Format date
  const saleDate = new Date(invoice.sale_date).toLocaleString('en-ET', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  resultsDiv.innerHTML = `
    <!-- Verification Success Banner -->
    <div class="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg mb-6">
      <div class="flex items-center">
        <i class="fas fa-check-circle text-green-500 text-3xl mr-4"></i>
        <div>
          <h3 class="text-lg font-semibold text-green-800">Invoice Verified Successfully</h3>
          <p class="text-green-700 mt-1">This invoice is authentic and registered in the system.</p>
        </div>
      </div>
    </div>
    
    <!-- Invoice Details -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Left Column: Invoice Info -->
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <i class="fas fa-file-invoice text-indigo-600 mr-2"></i>
          Invoice Information
        </h3>
        
        <div class="space-y-3">
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">Invoice Number:</span>
            <span class="font-semibold text-gray-900">${invoice.invoice_number}</span>
          </div>
          
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">Sale Date:</span>
            <span class="font-semibold text-gray-900">${saleDate}</span>
          </div>
          
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">Payment Method:</span>
            <span class="font-semibold text-gray-900">${invoice.payment_method}</span>
          </div>
          
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">Cashier:</span>
            <span class="font-semibold text-gray-900">${invoice.cashier || 'N/A'}</span>
          </div>
          
          <div class="flex justify-between py-2">
            <span class="text-gray-600">ERCA Sync Status:</span>
            ${syncStatusBadge}
          </div>
          
          ${invoice.erca_sync_date ? `
            <div class="flex justify-between py-2">
              <span class="text-gray-600">Sync Date:</span>
              <span class="font-semibold text-gray-900">${new Date(invoice.erca_sync_date).toLocaleString()}</span>
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Right Column: Business Info -->
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <i class="fas fa-building text-indigo-600 mr-2"></i>
          Business Information
        </h3>
        
        <div class="space-y-3">
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">Business Name:</span>
            <span class="font-semibold text-gray-900">${invoice.business_name}</span>
          </div>
          
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">TIN:</span>
            <span class="font-mono font-semibold text-indigo-600">${invoice.business_tin}</span>
          </div>
          
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">Location:</span>
            <span class="font-semibold text-gray-900">${invoice.location}</span>
          </div>
          
          <div class="flex justify-between py-2 border-b">
            <span class="text-gray-600">Region:</span>
            <span class="font-semibold text-gray-900">${invoice.region}</span>
          </div>
          
          <div class="flex justify-between py-2">
            <span class="text-gray-600">Business Type:</span>
            <span class="font-semibold text-gray-900">${invoice.business_type}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Financial Summary -->
    <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white mb-6">
      <h3 class="text-lg font-semibold mb-4 flex items-center">
        <i class="fas fa-calculator mr-2"></i>
        Financial Summary
      </h3>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white bg-opacity-20 rounded-lg p-4">
          <p class="text-sm opacity-90">Subtotal</p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(invoice.subtotal)}</p>
        </div>
        
        <div class="bg-white bg-opacity-20 rounded-lg p-4">
          <p class="text-sm opacity-90">VAT (15%)</p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(invoice.vat_amount)}</p>
        </div>
        
        <div class="bg-white bg-opacity-20 rounded-lg p-4">
          <p class="text-sm opacity-90">Turnover Tax (2%)</p>
          <p class="text-2xl font-bold mt-1">${formatCurrency(invoice.turnover_tax)}</p>
        </div>
        
        <div class="bg-white bg-opacity-20 rounded-lg p-4">
          <p class="text-sm opacity-90">Total</p>
          <p class="text-3xl font-bold mt-1">${formatCurrency(invoice.total_amount)}</p>
        </div>
      </div>
    </div>
    
    <!-- Invoice Items -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <i class="fas fa-list text-indigo-600 mr-2"></i>
        Invoice Items
      </h3>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${invoice.items.map(item => `
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.product_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.category || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">${item.quantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">${formatCurrency(item.unit_price)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">${formatCurrency(item.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="mt-6 flex justify-end space-x-4">
      <button 
        onclick="printInvoice()"
        class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition"
      >
        <i class="fas fa-print mr-2"></i>
        Print Report
      </button>
      
      <button 
        onclick="resetSearch()"
        class="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
      >
        <i class="fas fa-search mr-2"></i>
        Verify Another Invoice
      </button>
    </div>
  `;
}

// Show loading state
function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('error-state').classList.add('hidden');
  document.getElementById('verification-results').classList.add('hidden');
}

// Show error state
function showError(message) {
  const errorDiv = document.getElementById('error-state');
  const loadingDiv = document.getElementById('loading-state');
  const resultsDiv = document.getElementById('verification-results');
  
  loadingDiv.classList.add('hidden');
  resultsDiv.classList.add('hidden');
  errorDiv.classList.remove('hidden');
  
  errorDiv.querySelector('p').textContent = message;
}

// Reset search
function resetSearch() {
  document.getElementById('invoice-number').value = '';
  document.getElementById('invoice-number').focus();
  document.getElementById('verification-results').classList.add('hidden');
  document.getElementById('error-state').classList.add('hidden');
}

// Print invoice
function printInvoice() {
  window.print();
}

// Get sync status badge
function getSyncStatusBadge(status) {
  const badges = {
    'synced': '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><i class="fas fa-check-circle mr-1"></i>Synced</span>',
    'pending': '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"><i class="fas fa-clock mr-1"></i>Pending</span>',
    'failed': '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><i class="fas fa-exclamation-circle mr-1"></i>Failed</span>'
  };
  return badges[status] || badges['pending'];
}

// Log audit trail
async function logAudit(action, entityType, entityId) {
  try {
    await axios.post('https://9115feb4.fredo-vpos.pages.dev/api/audit/log', {
      user_id: currentOfficial.id,
      action: action,
      entity_type: entityType,
      entity_id: entityId,
      details: `ERCA official ${currentOfficial.full_name} verified ${entityType} ${entityId}`
    });
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2
  }).format(amount);
}

// Export functions
window.resetSearch = resetSearch;
window.printInvoice = printInvoice;
