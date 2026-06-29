/* ============================================================
   STOCK MANAGEMENT — FULL FRONTEND APPLICATION
   ============================================================ */

// ==================== CONFIGURATION ====================
const CONFIG = {
  API_URL: 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev',
  // Set to '' to use localStorage-only mode (no backend needed for demo)
  STORAGE_KEY: 'stock_mgmt_data',
};

// ==================== DATA STORE ====================
const Store = {
  data: {
    user: null,
    settings: {
      businessName: '',
      businessType: 'other',
      currency: '$',
      updateFrequency: 'weekly',
      notifFrequency: 'weekly',
      lowStockThreshold: 5,
    },
    stock: [],          // { id, name, brand, category, size, sku, costPrice, sellPrice, qty, originalQty, discount, supplier, date, transGo, transReturn, notes, previousStock, totalQty, costPerUnit, createdAt }
    sales: [],          // { id, date, items: [{ stockId, name, qty, price }], totalRevenue, totalItems }
    notifications: [],  // { id, type, title, body, time, read }
    activity: [],       // { id, icon, text, time }
  },

  load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  },

  save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  },

  clear() {
    this.data = {
      user: null,
      settings: { businessName: '', businessType: 'other', currency: '$', updateFrequency: 'weekly', notifFrequency: 'weekly', lowStockThreshold: 5 },
      stock: [], sales: [], notifications: [], activity: []
    };
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  },

  addActivity(icon, text) {
    this.data.activity.unshift({
      id: Date.now(),
      icon,
      text,
      time: new Date().toISOString()
    });
    if (this.data.activity.length > 50) this.data.activity.pop();
    this.save();
  },

  addNotification(type, title, body) {
    this.data.notifications.unshift({
      id: Date.now(),
      type,
      title,
      body,
      time: new Date().toISOString(),
      read: false
    });
    this.save();
  }
};

// ==================== UTILITY FUNCTIONS ====================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function cur(amount) {
  const c = Store.data.settings.currency || '$';
  return `${c}${parseFloat(amount || 0).toFixed(2)}`;
}
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
  const container = $('#toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ==================== RIPPLE EFFECT ====================
function addRipple(e) {
  const btn = e.currentTarget;
  const circle = document.createElement('span');
  const diameter = Math.max(btn.clientWidth, btn.clientHeight);
  const radius = diameter / 2;
  const rect = btn.getBoundingClientRect();
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${e.clientX - rect.left - radius}px`;
  circle.style.top = `${e.clientY - rect.top - radius}px`;
  circle.classList.add('ripple');
  const existing = btn.querySelector('.ripple');
  if (existing) existing.remove();
  btn.appendChild(circle);
}

$$('.btn-ripple').forEach(btn => btn.addEventListener('click', addRipple));

// ==================== PARTICLE BACKGROUND ====================
function initParticles() {
  const canvas = $('#particleCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  const PARTICLE_COUNT = 60;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.5;
      this.speedY = (Math.random() - 0.5) * 0.5;
      this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(79, 125, 249, ${this.opacity})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  function connectParticles() {
    for (let a = 0; a < particles.length; a++) {
      for (let b = a + 1; b < particles.length; b++) {
        const dx = particles[a].x - particles[b].x;
        const dy = particles[a].y - particles[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(79, 125, 249, ${0.08 * (1 - dist / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[a].x, particles[a].y);
          ctx.lineTo(particles[b].x, particles[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    connectParticles();
    requestAnimationFrame(animate);
  }
  animate();
}

// ==================== CONFETTI ====================
function fireConfetti() {
  const colors = ['#4f7df9', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = (6 + Math.random() * 8) + 'px';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

// ==================== CATEGORY MANAGEMENT ====================
const CATEGORIES_BY_TYPE = {
  liquor_store: ['Beer', 'Wine', 'Spirits', 'Cider', 'Coolers', 'Mixers', 'Snacks', 'Tobacco', 'Other'],
  tuck_shop: ['Beverages', 'Snacks', 'Sweets', 'Bread', 'Dairy', 'Canned Goods', 'Household', 'Airtime', 'Other'],
  salon: ['Hair Products', 'Skin Care', 'Nail Products', 'Tools', 'Coloring', 'Shampoo', 'Conditioner', 'Other'],
  grocery: ['Produce', 'Meat', 'Dairy', 'Bakery', 'Beverages', 'Frozen', 'Canned', 'Cleaning', 'Other'],
  clothing: ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories', 'Underwear', 'Other'],
  electronics: ['Phones', 'Accessories', 'Audio', 'Computers', 'Gaming', 'Cables', 'Other'],
  pharmacy: ['OTC Medicine', 'Vitamins', 'First Aid', 'Personal Care', 'Baby Care', 'Other'],
  hardware: ['Tools', 'Paint', 'Electrical', 'Plumbing', 'Fasteners', 'Building', 'Other'],
  restaurant: ['Ingredients', 'Beverages', 'Packaging', 'Cleaning', 'Other'],
  service: ['Supplies', 'Equipment', 'Consumables', 'Other'],
  other: ['General', 'Category A', 'Category B', 'Category C', 'Other'],
};

function getCategories() {
  const type = Store.data.settings.businessType || 'other';
  return CATEGORIES_BY_TYPE[type] || CATEGORIES_BY_TYPE.other;
}

function populateCategorySelects() {
  const cats = getCategories();
  const selects = [$('#stockCategory'), $('#filterCategory')];
  selects.forEach(sel => {
    if (!sel) return;
    const firstOpt = sel.querySelector('option');
    sel.innerHTML = '';
    if (firstOpt) sel.appendChild(firstOpt);
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.toLowerCase().replace(/\s+/g, '_');
      opt.textContent = c;
      sel.appendChild(opt);
    });
  });
}

function populateBrandFilter() {
  const sel = $('#filterBrand');
  if (!sel) return;
  const brands = [...new Set(Store.data.stock.map(s => s.brand).filter(Boolean))];
  sel.innerHTML = '<option value="">All Brands</option>';
  brands.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
}

// ==================== NOTIFICATION ENGINE ====================
function checkLowStock() {
  const threshold = Store.data.settings.lowStockThreshold || 5;
  Store.data.stock.forEach(item => {
    const remaining = item.totalQty - (item.soldQty || 0);
    if (remaining <= 0) {
      const existing = Store.data.notifications.find(n => n.title.includes(item.name) && n.type === 'critical' && !n.read);
      if (!existing) {
        Store.addNotification('critical', `🚨 ${item.name} is OUT OF STOCK!`, `Time to restock ${item.name} (${item.brand || 'No brand'}). Current quantity: 0.`);
        Store.addActivity('🚨', `${item.name} is out of stock!`);
      }
    } else if (remaining <= threshold) {
      const existing = Store.data.notifications.find(n => n.title.includes(item.name) && n.type === 'warning' && !n.read);
      if (!existing) {
        Store.addNotification('warning', `⚠️ ${item.name} is low on stock`, `Only ${remaining} units remaining. Consider restocking soon.`);
        Store.addActivity('⚠️', `${item.name} running low (${remaining} left)`);
      }
    }
  });
}

function generatePeriodicReport() {
  const totalStock = Store.data.stock.length;
  const lowStockCount = Store.data.stock.filter(s => {
    const rem = s.totalQty - (s.soldQty || 0);
    return rem <= (Store.data.settings.lowStockThreshold || 5);
  }).length;
  const outCount = Store.data.stock.filter(s => (s.totalQty - (s.soldQty || 0)) <= 0).length;

  const summary = Store.data.stock.map(s => {
    const rem = s.totalQty - (s.soldQty || 0);
    return `${s.name}: ${rem} left`;
  }).join('\n');

  if (totalStock > 0) {
    Store.addNotification('info', '📊 Periodic Stock Report',
      `Total items: ${totalStock} | Low stock: ${lowStockCount} | Out of stock: ${outCount}\n\n${summary}`
    );
  }
}

function shouldGenerateReport() {
  const freq = Store.data.settings.notifFrequency || 'weekly';
  const now = new Date();
  const lastReport = Store.data.notifications.find(n => n.title.includes('Periodic Stock Report'));
  if (!lastReport) return true;

  const last = new Date(lastReport.time);
  const diffDays = (now - last) / (1000 * 60 * 60 * 24);

  switch (freq) {
    case 'daily': return diffDays >= 1;
    case 'weekly': return diffDays >= 7;
    case 'biweekly': return diffDays >= 15;
    case 'monthly': return diffDays >= 30;
    default: return diffDays >= 7;
  }
}

function runNotificationChecks() {
  checkLowStock();
  if (shouldGenerateReport()) generatePeriodicReport();
  updateNotifBadge();
}

function updateNotifBadge() {
  const unread = Store.data.notifications.filter(n => !n.read).length;
  const badge = $('#notifBadge');
  const dot = $('#topbarNotifBadge');
  if (unread > 0) {
    badge.textContent = unread;
    badge.classList.remove('hidden');
    dot.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    dot.classList.add('hidden');
  }
}

// ==================== SPLASH SCREEN ====================
function hideSplash() {
  const splash = $('#splashScreen');
  splash.classList.add('hiding');
  setTimeout(() => splash.remove(), 700);
}

// ==================== AUTH ====================
function initAuth() {
  const loginForm = $('#loginForm');
  const registerForm = $('#registerForm');
  const toggleBtn = $('#toggleAuthBtn');
  const toggleText = $('#toggleAuthText');
  let isLogin = true;

  toggleBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    toggleBtn.textContent = isLogin ? 'Register' : 'Sign In';
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value;
    const password = $('#loginPassword').value;

    // Simple local auth
    const users = JSON.parse(localStorage.getItem('sm_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      Store.data.user = user;
      Store.save();
      showApp();
      showToast('Welcome back! 🎉', 'success');
    } else {
      showToast('Invalid email or password', 'error');
    }
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = {
      id: genId(),
      businessName: $('#regBusiness').value,
      businessType: $('#regBizType').value,
      email: $('#regEmail').value,
      password: $('#regPassword').value,
    };

    const users = JSON.parse(localStorage.getItem('sm_users') || '[]');
    if (users.find(u => u.email === user.email)) {
      showToast('Email already registered', 'error');
      return;
    }

    users.push(user);
    localStorage.setItem('sm_users', JSON.stringify(users));

    Store.data.user = user;
    Store.data.settings.businessName = user.businessName;
    Store.data.settings.businessType = user.businessType;
    Store.save();

    showApp();
    showToast('Account created! Welcome! 🎉', 'success');
    fireConfetti();
  });
}

function showApp() {
  $('#authScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  if (Store.data.user) {
    $('#topbarAvatar').textContent = Store.data.user.businessName.charAt(0).toUpperCase();
  }
  populateCategorySelects();
  populateBrandFilter();
  updateDashboard();
  runNotificationChecks();
}

// ==================== NAVIGATION ====================
function initNav() {
  $$('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Quick actions
  $$('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'addStock') navigateTo('stock');
      else if (action === 'recordSale') navigateTo('sales');
      else if (action === 'viewReports') navigateTo('reports');
      else if (action === 'restock') navigateTo('inventory');
    });
  });

  // Sidebar toggle
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.add('open'));
  $('#sidebarClose').addEventListener('click', () => $('#sidebar').classList.remove('open'));
  $('#topbarNotifBtn').addEventListener('click', () => navigateTo('notifications'));

  // Logout
  $('#logoutBtn').addEventListener('click', () => {
    Store.data.user = null;
    Store.save();
    $('#appScreen').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
    showToast('Logged out', 'info');
  });
}

function navigateTo(page) {
  $$('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
  const activeNav = $(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  $$('.page').forEach(p => p.classList.remove('active'));
  const activePage = $(`#page-${page}`);
  if (activePage) activePage.classList.add('active');

  $('#sidebar').classList.remove('open');

  // Refresh page data
  if (page === 'dashboard') updateDashboard();
  else if (page === 'inventory') renderInventory();
  else if (page === 'sales') renderSalesList();
  else if (page === 'reports') renderReports();
  else if (page === 'notifications') renderNotifications();
  else if (page === 'settings') loadSettings();
}

// ==================== DASHBOARD ====================
function updateDashboard() {
  const stock = Store.data.stock;
  const sales = Store.data.sales;
  const threshold = Store.data.settings.lowStockThreshold || 5;
  const today = todayStr();

  const totalProducts = stock.length;
  const todaySales = sales.filter(s => s.date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const todayItems = todaySales.reduce((sum, s) => sum + s.totalItems, 0);
  const lowStockCount = stock.filter(s => (s.totalQty - (s.soldQty || 0)) <= threshold).length;

  animateNumber('#statTotalStock', totalProducts);
  $('#statTodayRevenue').textContent = cur(todayRevenue);
  animateNumber('#statItemsSold', todayItems);
  animateNumber('#statLowStock', lowStockCount);

  // Recent activity
  const actList = $('#recentActivity');
  if (Store.data.activity.length === 0) {
    actList.innerHTML = '<p class="empty-state">No recent activity</p>';
  } else {
    actList.innerHTML = Store.data.activity.slice(0, 10).map(a => `
      <div class="activity-item">
        <div class="activity-icon">${a.icon}</div>
        <div class="activity-info">
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${timeAgo(a.time)}</div>
        </div>
      </div>
    `).join('');
  }

  // Low stock
  const lowList = $('#lowStockList');
  const lowItems = stock.filter(s => (s.totalQty - (s.soldQty || 0)) <= threshold);
  if (lowItems.length === 0) {
    lowList.innerHTML = '<p class="empty-state">All stock levels healthy ✅</p>';
  } else {
    lowList.innerHTML = lowItems.map(s => {
      const rem = s.totalQty - (s.soldQty || 0);
      const isOut = rem <= 0;
      return `
        <div class="activity-item">
          <div class="activity-icon">${isOut ? '🔴' : '🟡'}</div>
          <div class="activity-info">
            <div class="activity-text"><strong>${s.name}</strong> — ${isOut ? 'OUT OF STOCK' : `${rem} remaining`}</div>
            <div class="activity-time">${s.brand || 'No brand'} · ${s.category}</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function animateNumber(selector, target) {
  const el = $(selector);
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ==================== STOCK FORM ====================
function initStockForm() {
  const form = $('#stockForm');
  const dateInput = $('#stockDate');
  dateInput.value = todayStr();

  // Live cost summary
  const updateSummary = () => {
    const cost = parseFloat($('#stockCostPrice').value) || 0;
    const qty = parseInt($('#stockQty').value) || 0;
    const discount = parseFloat($('#stockDiscount').value) || 0;
    const transGo = parseFloat($('#stockTransGo').value) || 0;
    const transReturn = parseFloat($('#stockTransReturn').value) || 0;

    const subtotal = cost * qty;
    const discountAmt = subtotal * (discount / 100);
    const afterDiscount = subtotal - discountAmt;
    const transport = transGo + transReturn;
    const total = afterDiscount + transport;
    const totalQty = qty + (parseInt($('#stockPrevious').value) || 0);
    const perUnit = totalQty > 0 ? total / totalQty : 0;

    $('#sumSubtotal').textContent = cur(subtotal);
    $('#sumDiscount').textContent = `-${cur(discountAmt)}`;
    $('#sumTransport').textContent = cur(transport);
    $('#sumTotal').textContent = cur(total);
    $('#sumPerUnit').textContent = cur(perUnit);
  };

  ['stockCostPrice', 'stockQty', 'stockDiscount', 'stockTransGo', 'stockTransReturn', 'stockPrevious'].forEach(id => {
    $(`#${id}`).addEventListener('input', updateSummary);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const cost = parseFloat($('#stockCostPrice').value) || 0;
    const qty = parseInt($('#stockQty').value) || 0;
    const discount = parseFloat($('#stockDiscount').value) || 0;
    const transGo = parseFloat($('#stockTransGo').value) || 0;
    const transReturn = parseFloat($('#stockTransReturn').value) || 0;
    const previous = parseInt($('#stockPrevious').value) || 0;

    const subtotal = cost * qty;
    const discountAmt = subtotal * (discount / 100);
    const total = subtotal - discountAmt + transGo + transReturn;
    const totalQty = qty + previous;
    const costPerUnit = totalQty > 0 ? total / totalQty : 0;

    const entry = {
      id: genId(),
      name: $('#stockName').value,
      brand: $('#stockBrand').value,
      category: $('#stockCategory').value,
      size: $('#stockSize').value,
      sku: $('#stockSKU').value,
      costPrice: cost,
      sellPrice: parseFloat($('#stockSellPrice').value) || 0,
      qty: qty,
      originalQty: qty,
      discount: discount,
      supplier: $('#stockSupplier').value,
      date: $('#stockDate').value,
      transGo: transGo,
      transReturn: transReturn,
      notes: $('#stockNotes').value,
      previousStock: previous,
      totalQty: totalQty,
      soldQty: 0,
      costPerUnit: costPerUnit,
      totalCost: total,
      createdAt: new Date().toISOString(),
    };

    Store.data.stock.push(entry);
    Store.addActivity('📦', `Added ${qty}x ${entry.name} from ${entry.supplier}`);
    Store.save();

    form.reset();
    dateInput.value = todayStr();
    $('#stockDiscount').value = '0';
    $('#stockPrevious').value = '0';
    updateSummary();

    showToast(`${entry.name} added to inventory! 📦`, 'success');
    fireConfetti();
    checkLowStock();
    updateNotifBadge();
  });
}

// ==================== INVENTORY ====================
function renderInventory() {
  const grid = $('#inventoryGrid');
  const search = ($('#inventorySearch')?.value || '').toLowerCase();
  const catFilter = $('#filterCategory')?.value || '';
  const brandFilter = $('#filterBrand')?.value || '';
  const statusFilter = $('#filterStatus')?.value || '';
  const threshold = Store.data.settings.lowStockThreshold || 5;

  let items = Store.data.stock.filter(s => {
    const remaining = s.totalQty - (s.soldQty || 0);
    if (search && !s.name.toLowerCase().includes(search) && !(s.brand || '').toLowerCase().includes(search)) return false;
    if (catFilter && s.category !== catFilter) return false;
    if (brandFilter && s.brand !== brandFilter) return false;
    if (statusFilter === 'in_stock' && remaining <= threshold) return false;
    if (statusFilter === 'low_stock' && (remaining > threshold || remaining <= 0)) return false;
    if (statusFilter === 'out_of_stock' && remaining > 0) return false;
    return true;
  });

  if (items.length === 0) {
    grid.innerHTML = '<p class="empty-state">No inventory found</p>';
    return;
  }

  grid.innerHTML = items.map(s => {
    const remaining = s.totalQty - (s.soldQty || 0);
    const pct = s.totalQty > 0 ? Math.max(0, (remaining / s.totalQty) * 100) : 0;
    let statusClass = 'in-stock', statusText = 'In Stock';
    if (remaining <= 0) { statusClass = 'out-of-stock'; statusText = 'Out of Stock'; }
    else if (remaining <= threshold) { statusClass = 'low-stock'; statusText = 'Low Stock'; }

    return `
      <div class="inv-card glass-card">
        <div class="inv-card-header">
          <div>
            <div class="inv-card-name">${s.name}</div>
            <div class="inv-card-brand">${s.brand || 'No brand'} · ${s.category}</div>
          </div>
          <span class="inv-status ${statusClass}">${statusText}</span>
        </div>
        <div class="inv-card-body">
          <div class="inv-detail">
            <div class="inv-detail-label">Remaining</div>
            <div class="inv-detail-value">${remaining} / ${s.totalQty}</div>
          </div>
          <div class="inv-detail">
            <div class="inv-detail-label">Sell Price</div>
            <div class="inv-detail-value">${cur(s.sellPrice)}</div>
          </div>
          <div class="inv-detail">
            <div class="inv-detail-label">Cost/Unit</div>
            <div class="inv-detail-value">${cur(s.costPerUnit)}</div>
          </div>
          <div class="inv-detail">
            <div class="inv-detail-label">Size</div>
            <div class="inv-detail-value">${s.size || 'N/A'}</div>
          </div>
          <div class="inv-detail">
            <div class="inv-detail-label">Supplier</div>
            <div class="inv-detail-value">${s.supplier}</div>
          </div>
          <div class="inv-detail">
            <div class="inv-detail-label">Date Added</div>
            <div class="inv-detail-value">${s.date}</div>
          </div>
        </div>
        <div class="inv-stock-bar">
          <div class="inv-stock-bar-fill ${remaining <= threshold ? 'low' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="inv-card-actions">
          <button class="inv-action-btn" onclick="editStock('${s.id}')">✏️ Edit</button>
          <button class="inv-action-btn delete" onclick="deleteStock('${s.id}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');

  populateBrandFilter();
}

function deleteStock(id) {
  if (!confirm('Delete this stock item?')) return;
  const item = Store.data.stock.find(s => s.id === id);
  Store.data.stock = Store.data.stock.filter(s => s.id !== id);
  if (item) Store.addActivity('🗑️', `Deleted ${item.name}`);
  Store.save();
  renderInventory();
  showToast('Stock item deleted', 'warning');
}

function editStock(id) {
  const item = Store.data.stock.find(s => s.id === id);
  if (!item) return;

  const modal = $('#modal');
  const body = $('#modalBody');
  body.innerHTML = `
    <h2 style="margin-bottom:1.5rem;font-family:'Space Grotesk',sans-serif;">Edit: ${item.name}</h2>
    <form id="editStockForm" style="display:flex;flex-direction:column;gap:1rem;">
      <div class="input-group">
        <label>Product Name</label>
        <input type="text" id="editName" value="${item.name}" required />
      </div>
      <div class="input-group">
        <label>Brand</label>
        <input type="text" id="editBrand" value="${item.brand || ''}" />
      </div>
      <div class="input-group">
        <label>Selling Price</label>
        <input type="number" id="editSellPrice" step="0.01" value="${item.sellPrice}" />
      </div>
      <div class="input-group">
        <label>Total Quantity</label>
        <input type="number" id="editTotalQty" min="0" value="${item.totalQty}" />
      </div>
      <div class="input-group">
        <label>Sold Quantity</label>
        <input type="number" id="editSoldQty" min="0" value="${item.soldQty || 0}" />
      </div>
      <button type="submit" class="btn btn-primary btn-ripple">Save Changes</button>
    </form>
  `;
  modal.classList.remove('hidden');

  $('#editStockForm').addEventListener('submit', (e) => {
    e.preventDefault();
    item.name = $('#editName').value;
    item.brand = $('#editBrand').value;
    item.sellPrice = parseFloat($('#editSellPrice').value) || 0;
    item.totalQty = parseInt($('#editTotalQty').value) || 0;
    item.soldQty = parseInt($('#editSoldQty').value) || 0;
    Store.save();
    modal.classList.add('hidden');
    renderInventory();
    showToast('Stock updated! ✅', 'success');
  });
}

// ==================== SALES TRACKER ====================
function renderSalesList() {
  const list = $('#salesProductList');
  const submitBtn = $('#submitSalesBtn');
  const stock = Store.data.stock.filter(s => (s.totalQty - (s.soldQty || 0)) > 0);

  if (stock.length === 0) {
    list.innerHTML = '<p class="empty-state">No products available to sell. Add stock first!</p>';
    submitBtn.classList.add('hidden');
    return;
  }

  submitBtn.classList.remove('hidden');
  $('#saleDate').value = todayStr();

  list.innerHTML = stock.map(s => {
    const remaining = s.totalQty - (s.soldQty || 0);
    return `
      <div class="sale-item" data-stock-id="${s.id}">
        <div class="sale-checkbox" onclick="toggleSaleItem(this)" data-checked="false"></div>
        <div class="sale-item-info">
          <div class="sale-item-name">${s.name}</div>
          <div class="sale-item-meta">${s.brand || 'No brand'} · ${s.size || ''} · ${remaining} available · ${cur(s.sellPrice)} each</div>
        </div>
        <input type="number" class="sale-qty-input" min="0" max="${remaining}" value="0" data-price="${s.sellPrice}" data-stock-id="${s.id}" onchange="updateSaleTotal()" oninput="updateSaleTotal()" />
        <div class="sale-item-total">${cur(0)}</div>
      </div>
    `;
  }).join('');

  updateSaleTotal();
}

function toggleSaleItem(el) {
  const checked = el.dataset.checked === 'true';
  el.dataset.checked = (!checked).toString();
  el.classList.toggle('checked', !checked);
  el.textContent = !checked ? '✓' : '';
  el.closest('.sale-item').classList.toggle('sold', !checked);

  const qtyInput = el.closest('.sale-item').querySelector('.sale-qty-input');
  if (!checked && parseInt(qtyInput.value) === 0) {
    qtyInput.value = 1;
  }
  if (checked) {
    qtyInput.value = 0;
  }
  updateSaleTotal();
}

function updateSaleTotal() {
  let totalItems = 0, totalRevenue = 0;
  $$('.sale-item').forEach(item => {
    const qty = parseInt(item.querySelector('.sale-qty-input').value) || 0;
    const price = parseFloat(item.querySelector('.sale-qty-input').dataset.price) || 0;
    const total = qty * price;
    item.querySelector('.sale-item-total').textContent = cur(total);
    totalItems += qty;
    totalRevenue += total;
  });
  $('#saleTotalItems').textContent = totalItems;
  $('#saleTotalRevenue').textContent = cur(totalRevenue);
}

function initSalesSubmit() {
  $('#submitSalesBtn').addEventListener('click', () => {
    const items = [];
    let totalRevenue = 0, totalItems = 0;

    $$('.sale-item').forEach(item => {
      const qty = parseInt(item.querySelector('.sale-qty-input').value) || 0;
      if (qty > 0) {
        const stockId = item.querySelector('.sale-qty-input').dataset.stockId;
        const price = parseFloat(item.querySelector('.sale-qty-input').dataset.price) || 0;
        const name = item.querySelector('.sale-item-name').textContent;
        items.push({ stockId, name, qty, price });
        totalRevenue += qty * price;
        totalItems += qty;

        // Subtract from stock
        const stockItem = Store.data.stock.find(s => s.id === stockId);
        if (stockItem) {
          stockItem.soldQty = (stockItem.soldQty || 0) + qty;
        }
      }
    });

    if (items.length === 0) {
      showToast('No items sold today', 'warning');
      return;
    }

    const sale = {
      id: genId(),
      date: $('#saleDate').value || todayStr(),
      items,
      totalRevenue,
      totalItems,
    };

    Store.data.sales.push(sale);
    Store.addActivity('💰', `Sold ${totalItems} items for ${cur(totalRevenue)}`);
    Store.save();

    showToast(`Sales recorded! Revenue: ${cur(totalRevenue)} 🎉`, 'success');
    fireConfetti();
    runNotificationChecks();
    renderSalesList();
  });
}

// ==================== REPORTS ====================
function renderReports() {
  const period = $('#reportPeriod')?.value || 'week';
  const now = new Date();
  const sales = Store.data.sales.filter(s => {
    const d = new Date(s.date);
    switch (period) {
      case 'today': return s.date === todayStr();
      case 'week': return (now - d) / 86400000 <= 7;
      case 'month': return (now - d) / 86400000 <= 30;
      default: return true;
    }
  });

  const revenue = sales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const sold = sales.reduce((sum, s) => sum + s.totalItems, 0);
  const transport = Store.data.stock.reduce((sum, s) => sum + (s.transGo || 0) + (s.transReturn || 0), 0);
  const costOfGoods = sales.reduce((sum, s) => {
    return sum + s.items.reduce((isum, item) => {
      const stock = Store.data.stock.find(st => st.id === item.stockId);
      return isum + (stock ? stock.costPerUnit * item.qty : 0);
    }, 0);
  }, 0);
  const profit = revenue - costOfGoods;

  $('#reportRevenue').textContent = cur(revenue);
  $('#reportSold').textContent = sold;
  $('#reportProfit').textContent = cur(profit);
  $('#reportTransport').textContent = cur(transport);

  // Sales history
  const historyEl = $('#salesHistory');
  if (sales.length === 0) {
    historyEl.innerHTML = '<p class="empty-state">No sales recorded for this period</p>';
  } else {
    historyEl.innerHTML = sales.slice().reverse().map(s => `
      <div class="activity-item">
        <div class="activity-icon">💰</div>
        <div class="activity-info">
          <div class="activity-text">Sold ${s.totalItems} items — <strong>${cur(s.totalRevenue)}</strong></div>
          <div class="activity-time">${s.date} · ${s.items.map(i => `${i.name} x${i.qty}`).join(', ')}</div>
        </div>
      </div>
    `).join('');
  }
}

// ==================== NOTIFICATIONS ====================
function renderNotifications() {
  const list = $('#notificationsList');
  const notifs = Store.data.notifications;

  $('#notifFrequency').value = Store.data.settings.notifFrequency || 'weekly';
  $('#lowStockThreshold').value = Store.data.settings.lowStockThreshold || 5;

  if (notifs.length === 0) {
    list.innerHTML = '<p class="empty-state">No notifications yet</p>';
    return;
  }

  list.innerHTML = notifs.map(n => {
    if (!n.read) n.read = true; // Mark as read when viewed
    return `
      <div class="notif-item ${n.type} ${n.read ? '' : 'unread'}">
        <div class="notif-icon">${n.type === 'critical' ? '🚨' : n.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          <div class="notif-body">${n.body.replace(/\n/g, '<br>')}</div>
          <div class="notif-time">${timeAgo(n.time)}</div>
        </div>
      </div>
    `;
  }).join('');

  Store.save();
  updateNotifBadge();
}

// ==================== SETTINGS ====================
function loadSettings() {
  const s = Store.data.settings;
  $('#settBusinessName').value = s.businessName || '';
  $('#settBizType').value = s.businessType || 'other';
  $('#settCurrency').value = s.currency || '$';
  $('#settUpdateFreq').value = s.updateFrequency || 'weekly';
}

function initSettings() {
  $('#saveSettings').addEventListener('click', () => {
    Store.data.settings.businessName = $('#settBusinessName').value;
    Store.data.settings.businessType = $('#settBizType').value;
    Store.data.settings.currency = $('#settCurrency').value || '$';
    Store.data.settings.updateFrequency = $('#settUpdateFreq').value;
    Store.save();
    populateCategorySelects();
    showToast('Settings saved! ⚙️', 'success');
  });

  $('#saveNotifSettings').addEventListener('click', () => {
    Store.data.settings.notifFrequency = $('#notifFrequency').value;
    Store.data.settings.lowStockThreshold = parseInt($('#lowStockThreshold').value) || 5;
    Store.save();
    showToast('Notification settings saved! 🔔', 'success');
  });

  $('#clearAllData').addEventListener('click', () => {
    if (confirm('Are you sure? This will delete ALL stock, sales, and notification data!')) {
      Store.clear();
      showToast('All data cleared', 'warning');
      navigateTo('dashboard');
    }
  });

  // Report period change
  $('#reportPeriod')?.addEventListener('change', renderReports);

  // Inventory filters
  ['inventorySearch', 'filterCategory', 'filterBrand', 'filterStatus'].forEach(id => {
    const el = $(`#${id}`);
    if (el) el.addEventListener(id === 'inventorySearch' ? 'input' : 'change', renderInventory);
  });

  // View toggle
  $$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const grid = $('#inventoryGrid');
      grid.classList.toggle('list-view', btn.dataset.view === 'list');
    });
  });
}

// ==================== MODAL ====================
function initModal() {
  $('#modalClose').addEventListener('click', () => $('#modal').classList.add('hidden'));
  $('#modal').addEventListener('click', (e) => {
    if (e.target === $('#modal')) $('#modal').classList.add('hidden');
  });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  Store.load();

  // Show splash for 2.2s
  setTimeout(() => {
    hideSplash();
    setTimeout(() => {
      if (Store.data.user) {
        showApp();
      } else {
        $('#authScreen').classList.remove('hidden');
      }
    }, 400);
  }, 2200);

  initAuth();
  initNav();
  initStockForm();
  initSalesSubmit();
  initSettings();
  initModal();
});
