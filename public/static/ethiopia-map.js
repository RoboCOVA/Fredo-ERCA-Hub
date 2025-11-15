// Ethiopia Interactive Map for Revenue Visualization
// Simplified SVG-based map with regional data

const ethiopiaRegions = {
  'AA': { name: 'Addis Ababa', x: 200, y: 180, color: '#4F46E5' },
  'OR': { name: 'Oromia', x: 200, y: 220, color: '#06B6D4' },
  'AM': { name: 'Amhara', x: 200, y: 120, color: '#10B981' },
  'TG': { name: 'Tigray', x: 200, y: 40, color: '#F59E0B' },
  'SN': { name: 'SNNPR', x: 150, y: 280, color: '#EF4444' },
  'SO': { name: 'Somali', x: 320, y: 180, color: '#8B5CF6' },
  'BG': { name: 'Benishangul-Gumuz', x: 100, y: 160, color: '#EC4899' },
  'AF': { name: 'Afar', x: 280, y: 100, color: '#14B8A6' },
  'GM': { name: 'Gambela', x: 80, y: 200, color: '#F97316' },
  'HR': { name: 'Harari', x: 320, y: 220, color: '#6366F1' },
  'DD': { name: 'Dire Dawa', x: 300, y: 200, color: '#84CC16' },
  'SD': { name: 'Sidama', x: 180, y: 260, color: '#A855F7' },
  'SW': { name: 'South West', x: 140, y: 300, color: '#F43F5E' }
};

class EthiopiaMap {
  constructor(containerId, data = {}) {
    this.container = document.getElementById(containerId);
    this.data = data;
    this.svg = null;
    this.maxRevenue = 0;
    this.init();
  }

  init() {
    if (!this.container) {
      console.error('[Ethiopia Map] Container not found');
      return;
    }

    // Calculate max revenue for scaling
    this.maxRevenue = Math.max(...Object.values(this.data).map(d => d.revenue || 0), 1);

    // Create SVG
    this.createSVG();
    this.renderRegions();
    this.addLegend();
  }

  createSVG() {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '400');
    this.svg.setAttribute('viewBox', '0 0 400 350');
    this.svg.style.backgroundColor = '#F9FAFB';
    this.svg.style.borderRadius = '8px';
    
    this.container.appendChild(this.svg);
  }

  renderRegions() {
    Object.entries(ethiopiaRegions).forEach(([code, region]) => {
      const regionData = this.data[code] || { revenue: 0, businesses: 0, transactions: 0 };
      const intensity = regionData.revenue / this.maxRevenue;
      
      // Create region marker (circle)
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const radius = 15 + (intensity * 25); // Scale radius based on revenue
      
      circle.setAttribute('cx', region.x);
      circle.setAttribute('cy', region.y);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', region.color);
      circle.setAttribute('opacity', 0.3 + (intensity * 0.5));
      circle.setAttribute('stroke', region.color);
      circle.setAttribute('stroke-width', '2');
      circle.style.cursor = 'pointer';
      circle.style.transition = 'all 0.3s ease';
      
      // Add hover effect
      circle.addEventListener('mouseenter', (e) => {
        circle.setAttribute('opacity', '0.9');
        circle.setAttribute('r', radius + 5);
        this.showTooltip(e, code, region.name, regionData);
      });
      
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('opacity', 0.3 + (intensity * 0.5));
        circle.setAttribute('r', radius);
        this.hideTooltip();
      });
      
      this.svg.appendChild(circle);
      
      // Add region label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', region.x);
      text.setAttribute('y', region.y + 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', '#1F2937');
      text.textContent = code;
      text.style.pointerEvents = 'none';
      
      this.svg.appendChild(text);
    });
  }

  addLegend() {
    const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Legend background
    const legendBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    legendBg.setAttribute('x', '10');
    legendBg.setAttribute('y', '10');
    legendBg.setAttribute('width', '150');
    legendBg.setAttribute('height', '60');
    legendBg.setAttribute('fill', 'white');
    legendBg.setAttribute('opacity', '0.9');
    legendBg.setAttribute('rx', '5');
    legendGroup.appendChild(legendBg);
    
    // Legend title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '20');
    title.setAttribute('y', '30');
    title.setAttribute('font-size', '12');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#1F2937');
    title.textContent = 'Revenue by Region';
    legendGroup.appendChild(title);
    
    // Legend description
    const desc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    desc.setAttribute('x', '20');
    desc.setAttribute('y', '50');
    desc.setAttribute('font-size', '10');
    desc.setAttribute('fill', '#6B7280');
    desc.textContent = 'Circle size = revenue';
    legendGroup.appendChild(desc);
    
    this.svg.appendChild(legendGroup);
  }

  showTooltip(event, code, name, data) {
    const tooltip = document.getElementById('map-tooltip') || this.createTooltip();
    
    tooltip.innerHTML = `
      <div class="font-bold text-gray-900 mb-1">${name} (${code})</div>
      <div class="text-sm text-gray-600">
        <div>Revenue: ${this.formatCurrency(data.revenue || 0)}</div>
        <div>Businesses: ${data.businesses || 0}</div>
        <div>Transactions: ${data.transactions || 0}</div>
      </div>
    `;
    
    tooltip.style.display = 'block';
    tooltip.style.left = event.pageX + 15 + 'px';
    tooltip.style.top = event.pageY + 15 + 'px';
  }

  hideTooltip() {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'map-tooltip';
    tooltip.className = 'fixed bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50';
    tooltip.style.display = 'none';
    tooltip.style.pointerEvents = 'none';
    document.body.appendChild(tooltip);
    return tooltip;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-ET', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' ETB';
  }

  updateData(newData) {
    this.data = newData;
    this.maxRevenue = Math.max(...Object.values(this.data).map(d => d.revenue || 0), 1);
    
    // Clear and re-render
    this.container.innerHTML = '';
    this.init();
  }
}

// Export for use in erca-analytics.js
window.EthiopiaMap = EthiopiaMap;
