/* ============================================================
   STOCK MANAGEMENT — FULL FRONTEND WITH D1 DATABASE
   ============================================================ */

// ==================== CONFIGURATION ====================
const CONFIG = {
  API_URL: 'https://dataworker.mzaybus.workers.dev', 
  STORAGE_KEY: 'stock_mgmt_data',
  SYNC_INTERVAL: 30000, // Sync every 30 seconds
};

// ==================== API HELPER ====================
const API = {
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Auth
  async register(email, password, businessName, businessType) {
    return this.request('/api/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, businessName, businessType }),
    });
  },

  async login(email, password) {
    return this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Settings
  async getSettings(userId) {
    return this.request(`/api/settings?userId=${userId}`);
  },

  async updateSettings(userId, settings) {
    return this.request(`/api/settings?userId=${userId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  // Stock
  async getStock(userId) {
    return this.request(`/api/stock?userId=${userId}`);
  },

  async addStock(userId, stockData) {
    return this.request(`/api/stock?userId=${userId}`, {
      method: 'POST',
      body: JSON.stringify(stockData),
    });
  },

  async updateStock(userId, stockId, stockData) {
    return this.request(`/api/stock/${stockId}?userId=${userId}`, {
      method: 'PUT',
      body: JSON.stringify(stockData),
    });
  },

  async deleteStock(userId, stockId) {
    return this.request(`/api/stock/${stockId}?userId=${userId}`, {
      method: 'DELETE',
    });
  },

  // Sales
  async getSales(userId) {
    return this.request(`/api/sales?userId=${userId}`);
  },

  async addSale(userId, saleData) {
    return this.request(`/api/sales?userId=${userId}`, {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  },

  // Notifications
  async getNotifications(userId) {
    return this.request(`/api/notifications?userId=${userId}`);
  },

  async markNotificationsRead(userId) {
    return this.request(`/api/notifications?userId=${userId}`, {
      method: 'PUT',
    });
  },

  // Activity
  async getActivity(userId) {
    return this.request(`/api/activity?userId=${userId}`);
  },

  // Reports
  async getReports(userId, period = 'week') {
    return this.request(`/api/reports?userId=${userId}&period=${period}`);
  },
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
    stock: [],
    sales: [],
    notifications: [],
    activity: [],
  },

  syncTimer: null,

  async load() {
    // Load from localStorage first
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }

    // If user is logged in, sync with API
    if (this.data.user) {
      await this.syncFromAPI();
      this.startAutoSync();
    }
  },

  async syncFromAPI() {
    if (!this.data.user) return;

    try {
      const userId = this.data.user.id;

      // Fetch all data in parallel
      const [stock, sales, notifications, activity, settings] = await Promise.all([
        API.getStock(userId).catch(() => []),
        API.getSales(userId).catch(() => []),
        API.getNotifications(userId).catch(() => []),
        API.getActivity(userId).catch(() => []),
        API.getSettings(userId).catch(() => this.data.settings),
      ]);

      this.data.stock = stock;
      this.data.sales = sales;
      this.data.notifications = notifications.map(n => ({
        ...n,
        time: n.created_at,
        read: n.read === 1,
      }));
      this.data.activity = activity.map(a => ({
        ...a,
        time: a.created_at,
      }));
      this.data.settings = { ...this.data.settings, ...settings };

      this.save();
      console.log('Sync from API successful');
    } catch (e) {
      console.error('Sync from API failed:', e);
    }
  },

  save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  clear() {
    this.stopAutoSync();
    this.data = {
      user: null,
      settings: {
        businessName: '',
        businessType: 'other',
        currency: '$',
        updateFrequency: 'weekly',
        notifFrequency: 'weekly',
        lowStockThreshold: 5,
      },
      stock: [],
      sales: [],
      notifications: [],
      activity: [],
    };
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  },

  startAutoSync() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (this.data.user) {
        this.syncFromAPI();
      }
    }, CONFIG.SYNC_INTERVAL);
  },

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  },

  async addActivity(icon, text) {
    // Add to local
    this.data.activity.unshift({
      id: Date.now(),
      icon,
      text,
      time: new Date().toISOString(),
    });
    if (this.data.activity.length > 50) this.data.activity.pop();
    this.save();

    // Sync to API
    if (this.data.user) {
      try {
        await fetch(`${CONFIG.API_URL}/api/activity?userId=${this.data.user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icon, text }),
        });
      } catch (e) {
        console.error('Failed to sync activity:', e);
      }
    }
  },

  async addNotification(type, title, body) {
    // Add to local
    this.data.notifications.unshift({
      id: Date.now(),
      type,
      title,
      body,
      time: new Date().toISOString(),
      read: false,
    });
    this.save();

    // Sync to API
    if (this.data.user) {
      try {
        await fetch(`${CONFIG.API_URL}/api/notifications?userId=${this.data.user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, title, body }),
        });
      } catch (e) {
        console.error('Failed to sync notification:', e);
      }
    }
  },
};

// ==================== UTILITY FUNCTIONS ====================
function $(sel) {
  return document.querySelector(sel);
}
function $$(sel) {
  return document.querySelectorAll(sel);
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
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
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

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

$$('.btn-ripple').forEach((btn) => btn.addEventListener('click', addRipple));

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
    constructor() {
      this.reset();
    }
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
    particles.forEach((p) => {
      p.update();
      p.draw();
    });
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
    piece.style.animationDuration = 2 + Math.random() * 2 + 's';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = 6 + Math.random() * 8 + 'px';
    piece.style.height = 6 + Math.random() * 8 + 'px';
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
  selects.forEach((sel) => {
    if (!sel) return;
    const firstOpt = sel.querySelector('option');
    sel.innerHTML = '';
    if (firstOpt) sel.appendChild(firstOpt);
    cats.forEach((c) => {
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
  const brands = [...new Set(Store.data.stock.map((s) => s.brand).filter(Boolean))];
  sel.innerHTML = '<option value="">All Brands</option>';
  brands.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
}

// ==================== NOTIFICATION ENGINE ====================
function checkLowStock() {
  const threshold = Store.data.settings.lowStockThreshold || 5;
  Store.data.stock.forEach((item) => {
    const remaining = item.total_qty - (item.sold_qty || 0);
    if (remaining <= 0) {
      const existing = Store.data.notifications.find(
        (n) => n.title.includes(item.name) && n.type === 'critical' && !n.read
      );
      if (!existing) {
        Store.addNotification(
          'critical',
          `🚨 ${item.name} is OUT OF STOCK!`,
          `Time to restock ${item.name} (${item.brand || 'No brand'}). Current quantity: 0.`
        );
        Store.addActivity('🚨', `${item.name} is out of stock!`);
      }
    } else if (remaining <= threshold) {
      const existing = Store.data.notifications.find(
        (n) => n.title.includes(item.name) && n.type === 'warning' && !n.read
      );
      if (!existing) {
        Store.addNotification(
          'warning',
          `⚠️ ${item.name} is low on stock`,
          `Only ${remaining} units remaining. Consider restocking soon.`
        );
        Store.addActivity('⚠️', `${item.name} running low (${remaining} left)`);
      }
    }
  });
}

function updateNotifBadge() {
  const unread = Store.data.notifications.filter((n) => !n.read).length;
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
    toggleText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    toggleBtn.textContent = isLogin ? 'Register' : 'Sign In';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value;
    const password = $('#loginPassword').value;

    try {
      const result = await API.login(email, password);
      Store.data.user = {
        id: result.userId,
        email: result.user.email,
        businessName: result.user.businessName,
        businessType: result.user.businessType,
      };
      Store.data.settings = {
        ...Store.data.settings,
        businessName: result.user.businessName,
        businessType: result.user.businessType,
        currency: result.user.currency,
        updateFrequency: result.user.updateFrequency,
        notifFrequency: result.user.notifFrequency,
        lowStockThreshold: result.user.lowStockThreshold,
      };
      Store.save();
      await Store.syncFromAPI();
      Store.startAutoSync();
      showApp();
      showToast('Welcome back! 🎉', 'success');
    } catch (error) {
      showToast(error.message || 'Login failed', 'error');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const businessName = $('#regBusiness').value;
    const businessType = $('#regBizType').value;
    const email = $('#regEmail').value;
    const password = $('#regPassword').value;

    try {
      const result = await API.register(email, password, businessName, businessType);
      Store.data.user = {
        id: result.userId,
        email: result.user.email,
        businessName: result.user.businessName,
        businessType: result.user.businessType,
      };
      Store.data.settings.businessName = businessName;
      Store.data.settings.businessType = businessType;
      Store.save();
      Store.startAutoSync();
      showApp();
      showToast('Account created! Welcome! 🎉', 'success');
      fireConfetti();
    } catch (error) {
      showToast(error.message || 'Registration failed', 'error');
    }
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
  checkLowStock();
  updateNotifBadge();
}

// ==================== NAVIGATION ====================
function initNav() {
  $$('.nav-item[data-page]').forEach((item) => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  $$('.quick-action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'addStock') navigateTo('stock');
      else if (action === 'recordSale') navigateTo('sales');
      else if (action === 'viewReports') navigateTo('reports');
      else if (action === 'restock') navigateTo('inventory');
    });
  });

  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.add('open'));
  $('#sidebarClose').addEventListener('click', () => $('#sidebar').classList.remove('open'));
  $('#topbarNotifBtn').addEventListener('click', () => navigateTo('notifications'));

  $('#logoutBtn').addEventListener('click', () => {
    Store.clear();
    $('#appScreen').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
    showToast('Logged out', 'info');
  });
}

function navigateTo(page) {
  $$('.nav-item[data-page]').forEach((n) => n.classList.remove('active'));
  const activeNav = $(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  $$('.page').forEach((p) => p.classList.remove('active'));
  const activePage = $(`#page-${page}`);
  if (activePage) activePage.classList.add('active');

  $('#sidebar').classList.remove('open');

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
  const todaySales = sales.filter((s) => s.sale_date === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total_revenue, 0);
  const todayItems = todaySales.reduce((sum, s) => sum + s.total_items, 0);
  const lowStockCount = stock.filter((s) => s.total_qty - (s.sold_qty || 0) <= threshold).length;

  animateNumber('#statTotalStock', totalProducts);
  $('#statTodayRevenue').textContent = cur(todayRevenue);
  animateNumber('#statItemsSold', todayItems);
  animateNumber('#statLowStock', lowStockCount);

  const actList = $('#recentActivity');
  if (Store.data.activity.length === 0) {
    actList.innerHTML = '<p class="empty-state">No recent activity</p>';
  } else {
    actList.innerHTML = Store.data.activity
      .slice(0, 10)
      .map((a) => `
      <div class="activity-item">
        <div class="activity-icon">${a.icon}</div>
        <div class="activity-info">
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${timeAgo(a.time)}</div>
        </div>
      </div>
    `)
      .join('');
  }

  const lowList = $('#lowStockList');
  const lowItems = stock.filter((s) => s.total_qty - (s.sold_qty || 0) <= threshold);
  if (lowItems.length === 0) {
    lowList.innerHTML = '<p class="empty-state">All stock levels healthy ✅</p>';
  } else {
    lowList.innerHTML = lowItems
      .map((s) => {
        const rem = s.total_qty - (s.sold_qty || 0);
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
      })
      .join('');
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

  ['stockCostPrice', 'stockQty', 'stockDiscount', 'stockTransGo', 'stockTransReturn', 'stockPrevious'].forEach(
    (id) => {
      $(`#${id}`).addEventListener('input', updateSummary);
    }
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const stockData = {
      name: $('#stockName').value,
      brand: $('#stockBrand').value,
      category: $('#stockCategory').value,
      size: $('#stockSize').value,
      sku: $('#stockSKU').value,
      costPrice: parseFloat($('#stockCostPrice').value) || 0,
      sellPrice: parseFloat($('#stockSellPrice').value) || 0,
      qty: parseInt($('#stockQty').value) || 0,
      discount: parseFloat($('#stockDiscount').value) || 0,
      supplier: $('#stockSupplier').value,
      date: $('#stockDate').value,
      transGo: parseFloat($('#stockTransGo').value) || 0,
      transReturn: parseFloat($('#stockTransReturn').value) || 0,
      notes: $('#stockNotes').value,
      previousStock: parseInt($('#stockPrevious').value) || 0,
    };

    try {
      await API.addStock(Store.data.user.id, stockData);
      await Store.syncFromAPI();

      form.reset();
      dateInput.value = todayStr();
      $('#stockDiscount').value = '0';
      $('#stockPrevious').value = '0';
      updateSummary();

      showToast(`${stockData.name} added to inventory! 📦`, 'success');
      fireConfetti();
      checkLowStock();
      updateNotifBadge();
    } catch (error) {
      showToast(error.message || 'Failed to add stock', 'error');
    }
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

  let items = Store.data.stock.filter((s) => {
    const remaining = s.total_qty - (s.sold_qty || 0);
    if (search && !s.name.toLowerCase().includes(search) && !(s.brand || '').toLowerCase().includes(search))
      return false;
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

  grid.innerHTML = items
    .map((s) => {
      const remaining = s.total_qty - (s.sold_qty || 0);
      const pct = s.total_qty > 0 ? Math.max(0, (remaining / s.total_qty) * 100) : 0;
      let statusClass = 'in-stock',
        statusText = 'In Stock';
      if (remaining <= 0) {
        statusClass = 'out-of-stock';
        statusText = 'Out of Stock';
      } else if (remaining <= threshold) {
        statusClass = 'low-stock';
        statusText = 'Low Stock';
      }

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
            <div class="inv-detail-value">${remaining} / ${s.total_qty}</div>
          </div>
          <div class="inv-detail">
            <div class="inv-detail-label">Sell Price</div>
            <div class="inv-detail-value">${cur(s.sell_price)}</div>
          </div>
          <div class="inv-detail">
            <div class="inv-detail-label">Cost/Unit</div>
            <div class="inv-detail-value">${cur(s.cost_per_unit)}</div>
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
            <div class="inv-detail-value">${s.purchase_date}</div>
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
    })
    .join('');

  populateBrandFilter();
}

async function deleteStock(id) {
  if (!confirm('Delete this stock item?')) return;
  const item = Store.data.stock.find((s) => s.id === id);
  try {
    await API.deleteStock(Store.data.user.id, id);
    await Store.syncFromAPI();
    renderInventory();
    showToast('Stock item deleted', 'warning');
  } catch (error) {
    showToast(error.message || 'Failed to delete stock', 'error');
  }
}

function editStock(id) {
  const item = Store.data.stock.find((s) => s.id === id);
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
        <input type="number" id="editSellPrice" step="0.01" value="${item.sell_price}" />
      </div>
      <div class="input-group">
        <label>Total Quantity</label>
        <input type="number" id="editTotalQty" min="0" value="${item.total_qty}" />
      </div>
      <div class="input-group">
        <label>Sold Quantity</label>
        <input type="number" id="editSoldQty" min="0" value="${item.sold_qty || 0}" />
      </div>
      <button type="submit" class="btn btn-primary btn-ripple">Save Changes</button>
    </form>
  `;
  modal.classList.remove('hidden');

  $('#editStockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.updateStock(Store.data.user.id, id, {
        name: $('#editName').value,
        brand: $('#editBrand').value,
        sellPrice: parseFloat($('#editSellPrice').value) || 0,
        totalQty: parseInt($('#editTotalQty').value) || 0,
        soldQty: parseInt($('#editSoldQty').value) || 0,
      });
      await Store.syncFromAPI();
      modal.classList.add('hidden');
      renderInventory();
      showToast('Stock updated! ✅', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to update stock', 'error');
    }
  });
}

// ==================== SALES TRACKER ====================
function renderSalesList() {
  const list = $('#salesProductList');
  const submitBtn = $('#submitSalesBtn');
  const stock = Store.data.stock.filter((s) => s.total_qty - (s.sold_qty || 0) > 0);

  if (stock.length === 0) {
    list.innerHTML = '<p class="empty-state">No products available to sell. Add stock first!</p>';
    submitBtn.classList.add('hidden');
    return;
  }

  submitBtn.classList.remove('hidden');
  $('#saleDate').value = todayStr();

  list.innerHTML = stock
    .map((s) => {
      const remaining = s.total_qty - (s.sold_qty || 0);
      return `
      <div class="sale-item" data-stock-id="${s.id}">
        <div class="sale-checkbox" onclick="toggleSaleItem(this)" data-checked="false"></div>
        <div class="sale-item-info">
          <div class="sale-item-name">${s.name}</div>
          <div class="sale-item-meta">${s.brand || 'No brand'} · ${s.size || ''} · ${remaining} available · ${cur(
        s.sell_price
      )} each</div>
        </div>
        <input type="number" class="sale-qty-input" min="0" max="${remaining}" value="0" data-price="${
        s.sell_price
      }" data-stock-id="${s.id}" onchange="updateSaleTotal()" oninput="updateSaleTotal()" />
        <div class="sale-item-total">${cur(0)}</div>
      </div>
    `;
    })
    .join('');

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
  let totalItems = 0,
    totalRevenue = 0;
  $$('.sale-item').forEach((item) => {
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
  $('#submitSalesBtn').addEventListener('click', async () => {
    const items = [];
    let totalRevenue = 0,
      totalItems = 0;

    $$('.sale-item').forEach((item) => {
      const qty = parseInt(item.querySelector('.sale-qty-input').value) || 0;
      if (qty > 0) {
        const stockId = item.querySelector('.sale-qty-input').dataset.stockId;
        const price = parseFloat(item.querySelector('.sale-qty-input').dataset.price) || 0;
        const name = item.querySelector('.sale-item-name').textContent;
        items.push({ stockId, name, qty, price });
        totalRevenue += qty * price;
        totalItems += qty;
      }
    });

    if (items.length === 0) {
      showToast('No items sold today', 'warning');
      return;
    }

    const saleData = {
      date: $('#saleDate').value || todayStr(),
      items,
      totalRevenue,
      totalItems,
    };

    try {
      await API.addSale(Store.data.user.id, saleData);
      await Store.syncFromAPI();

      showToast(`Sales recorded! Revenue: ${cur(totalRevenue)} 🎉`, 'success');
      fireConfetti();
      checkLowStock();
      updateNotifBadge();
      renderSalesList();
    } catch (error) {
      showToast(error.message || 'Failed to record sales', 'error');
    }
  });
}

// ==================== REPORTS ====================
async function renderReports() {
  const period = $('#reportPeriod')?.value || 'week';

  try {
    const report = await API.getReports(Store.data.user.id, period);

    $('#reportRevenue').textContent = cur(report.revenue);
    $('#reportSold').textContent = report.sold;
    $('#reportProfit').textContent = cur(report.profit);
    $('#reportTransport').textContent = cur(report.transport);

    const historyEl = $('#salesHistory');
    if (Store.data.sales.length === 0) {
      historyEl.innerHTML = '<p class="empty-state">No sales recorded for this period</p>';
    } else {
      historyEl.innerHTML = Store.data.sales
        .slice()
        .reverse()
        .map((s) => `
          <div class="activity-item">
            <div class="activity-icon">💰</div>
            <div class="activity-info">
              <div class="activity-text">Sold ${s.total_items} items — <strong>${cur(s.total_revenue)}</strong></div>
              <div class="activity-time">${s.sale_date}</div>
            </div>
          </div>
        `)
        .join('');
    }
  } catch (error) {
    showToast('Failed to load reports', 'error');
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

  list.innerHTML = notifs
    .map((n) => {
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
    })
    .join('');

  // Mark as read
  if (Store.data.user) {
    API.markNotificationsRead(Store.data.user.id).then(() => {
      Store.data.notifications.forEach((n) => (n.read = true));
      Store.save();
      updateNotifBadge();
    });
  }
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
  $('#saveSettings').addEventListener('click', async () => {
    const settings = {
      businessName: $('#settBusinessName').value,
      businessType: $('#settBizType').value,
      currency: $('#settCurrency').value || '$',
      updateFrequency: $('#settUpdateFreq').value,
    };

    try {
      await API.updateSettings(Store.data.user.id, settings);
      Store.data.settings = { ...Store.data.settings, ...settings };
      Store.save();
      populateCategorySelects();
      showToast('Settings saved! ⚙️', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to save settings', 'error');
    }
  });

  $('#saveNotifSettings').addEventListener('click', async () => {
    const settings = {
      notifFrequency: $('#notifFrequency').value,
      lowStockThreshold: parseInt($('#lowStockThreshold').value) || 5,
    };

    try {
      await API.updateSettings(Store.data.user.id, settings);
      Store.data.settings = { ...Store.data.settings, ...settings };
      Store.save();
      showToast('Notification settings saved! 🔔', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to save notification settings', 'error');
    }
  });

  $('#clearAllData').addEventListener('click', async () => {
    if (confirm('Are you sure? This will delete ALL stock, sales, and notification data!')) {
      Store.clear();
      showToast('All data cleared', 'warning');
      navigateTo('dashboard');
    }
  });

  $('#reportPeriod')?.addEventListener('change', renderReports);

  ['inventorySearch', 'filterCategory', 'filterBrand', 'filterStatus'].forEach((id) => {
    const el = $(`#${id}`);
    if (el) el.addEventListener(id === 'inventorySearch' ? 'input' : 'change', renderInventory);
  });

  $$('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.view-btn').forEach((b) => b.classList.remove('active'));
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
document.addEventListener('DOMContentLoaded', async () => {
  initParticles();
  await Store.load();

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
