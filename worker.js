// Stock Management Worker with D1 Database - CORS Fixed
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers - Allow all origins for now
    const headers = {
      'Access-Control-Allow-Origin': 'https://dataworker.mzaybus.workers.dev',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight (OPTIONS request)
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // Health check
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'Stock Management API is running!',
        timestamp: new Date().toISOString()
      }), { headers });
    }

    try {
      // AUTH ROUTES
      if (path === '/api/register' && method === 'POST') {
        return await handleRegister(request, env.DB, headers);
      }
      if (path === '/api/login' && method === 'POST') {
        return await handleLogin(request, env.DB, headers);
      }

      // Extract user ID
      const userId = url.searchParams.get('userId') || request.headers.get('X-User-Id');
      
      if (!userId && path.startsWith('/api/') && !path.includes('/register') && !path.includes('/login')) {
        return new Response(JSON.stringify({ error: 'Missing userId parameter' }), { status: 400, headers });
      }

      // USER SETTINGS
      if (path === '/api/settings' && method === 'GET') {
        return await getSettings(userId, env.DB, headers);
      }
      if (path === '/api/settings' && method === 'PUT') {
        return await updateSettings(request, userId, env.DB, headers);
      }

      // STOCK CRUD
      if (path === '/api/stock' && method === 'GET') {
        return await getStock(userId, env.DB, headers);
      }
      if (path === '/api/stock' && method === 'POST') {
        return await addStock(request, userId, env.DB, headers);
      }
      if (path.match(/^\/api\/stock\/[\w-]+$/) && method === 'PUT') {
        const stockId = path.split('/').pop();
        return await updateStock(request, userId, stockId, env.DB, headers);
      }
      if (path.match(/^\/api\/stock\/[\w-]+$/) && method === 'DELETE') {
        const stockId = path.split('/').pop();
        return await deleteStock(userId, stockId, env.DB, headers);
      }

      // SALES
      if (path === '/api/sales' && method === 'GET') {
        return await getSales(userId, env.DB, headers);
      }
      if (path === '/api/sales' && method === 'POST') {
        return await addSale(request, userId, env.DB, headers);
      }

      // NOTIFICATIONS
      if (path === '/api/notifications' && method === 'GET') {
        return await getNotifications(userId, env.DB, headers);
      }
      if (path === '/api/notifications' && method === 'PUT') {
        return await markNotificationsRead(userId, env.DB, headers);
      }

      // ACTIVITY
      if (path === '/api/activity' && method === 'GET') {
        return await getActivity(userId, env.DB, headers);
      }
      if (path === '/api/activity' && method === 'POST') {
        return await addActivity(request, userId, env.DB, headers);
      }

      // REPORTS
      if (path === '/api/reports' && method === 'GET') {
        return await getReports(userId, url, env.DB, headers);
      }

      return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }), { status: 500, headers });
    }
  },

  async scheduled(event, env, ctx) {
    console.log('Cron trigger fired:', new Date().toISOString());
    await generatePeriodicNotifications(env.DB);
  }
};

// ==================== AUTH HANDLERS ====================

async function handleRegister(request, db, headers) {
  try {
    const { email, password, businessName, businessType } = await request.json();
    
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400, headers });
    }

    // Check if user exists
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), { status: 409, headers });
    }

    // Create user
    const userId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO users (id, email, password, business_name, business_type)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, email, password, businessName || '', businessType || 'other').run();

    return new Response(JSON.stringify({
      success: true,
      userId,
      user: { 
        id: userId,
        email, 
        businessName, 
        businessType,
        currency: '$',
        updateFrequency: 'weekly',
        notifFrequency: 'weekly',
        lowStockThreshold: 5
      }
    }), { status: 201, headers });
  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}

async function handleLogin(request, db, headers) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400, headers });
    }

    const user = await db.prepare(`
      SELECT id, email, business_name, business_type, currency, update_frequency, notif_frequency, low_stock_threshold
      FROM users WHERE email = ? AND password = ?
    `).bind(email, password).first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers });
    }

    return new Response(JSON.stringify({
      success: true,
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        businessName: user.business_name,
        businessType: user.business_type,
        currency: user.currency,
        updateFrequency: user.update_frequency,
        notifFrequency: user.notif_frequency,
        lowStockThreshold: user.low_stock_threshold
      }
    }), { headers });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}

// ==================== SETTINGS HANDLERS ====================

async function getSettings(userId, db, headers) {
  const user = await db.prepare(`
    SELECT business_name, business_type, currency, update_frequency, notif_frequency, low_stock_threshold
    FROM users WHERE id = ?
  `).bind(userId).first();

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
  }

  return new Response(JSON.stringify({
    businessName: user.business_name,
    businessType: user.business_type,
    currency: user.currency,
    updateFrequency: user.update_frequency,
    notifFrequency: user.notif_frequency,
    lowStockThreshold: user.low_stock_threshold
  }), { headers });
}

async function updateSettings(request, userId, db, headers) {
  const settings = await request.json();
  
  await db.prepare(`
    UPDATE users SET
      business_name = ?,
      business_type = ?,
      currency = ?,
      update_frequency = ?,
      notif_frequency = ?,
      low_stock_threshold = ?
    WHERE id = ?
  `).bind(
    settings.businessName || '',
    settings.businessType || 'other',
    settings.currency || '$',
    settings.updateFrequency || 'weekly',
    settings.notifFrequency || 'weekly',
    settings.lowStockThreshold || 5,
    userId
  ).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

// ==================== STOCK HANDLERS ====================

async function getStock(userId, db, headers) {
  const results = await db.prepare(`
    SELECT * FROM stock WHERE user_id = ? ORDER BY created_at DESC
  `).bind(userId).all();

  return new Response(JSON.stringify(results.results), { headers });
}

async function addStock(request, userId, db, headers) {
  const data = await request.json();
  const stockId = crypto.randomUUID();

  const subtotal = (data.costPrice || 0) * (data.qty || 0);
  const discountAmt = subtotal * ((data.discount || 0) / 100);
  const total = subtotal - discountAmt + (data.transGo || 0) + (data.transReturn || 0);
  const totalQty = (data.qty || 0) + (data.previousStock || 0);
  const costPerUnit = totalQty > 0 ? total / totalQty : 0;

  await db.prepare(`
    INSERT INTO stock (
      id, user_id, name, brand, category, size, sku, cost_price, sell_price,
      qty, original_qty, discount, supplier, purchase_date, trans_go, trans_return,
      notes, previous_stock, total_qty, sold_qty, cost_per_unit, total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    stockId, userId, data.name, data.brand || '', data.category || '',
    data.size || '', data.sku || '', data.costPrice || 0, data.sellPrice || 0,
    data.qty || 0, data.qty || 0, data.discount || 0, data.supplier || '',
    data.date || new Date().toISOString().split('T')[0], data.transGo || 0,
    data.transReturn || 0, data.notes || '', data.previousStock || 0,
    totalQty, 0, costPerUnit, total
  ).run();

  await db.prepare(`
    INSERT INTO activity (user_id, icon, text) VALUES (?, ?, ?)
  `).bind(userId, '📦', `Added ${data.qty}x ${data.name} from ${data.supplier}`).run();

  await checkLowStock(userId, stockId, db);

  return new Response(JSON.stringify({ success: true, id: stockId }), { status: 201, headers });
}

async function updateStock(request, userId, stockId, db, headers) {
  const data = await request.json();
  
  await db.prepare(`
    UPDATE stock SET
      name = ?, brand = ?, sell_price = ?, total_qty = ?, sold_qty = ?
    WHERE id = ? AND user_id = ?
  `).bind(
    data.name, data.brand || '', data.sellPrice || 0,
    data.totalQty || 0, data.soldQty || 0, stockId, userId
  ).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

async function deleteStock(userId, stockId, db, headers) {
  await db.prepare(`
    DELETE FROM stock WHERE id = ? AND user_id = ?
  `).bind(stockId, userId).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

// ==================== SALES HANDLERS ====================

async function getSales(userId, db, headers) {
  const sales = await db.prepare(`
    SELECT * FROM sales WHERE user_id = ? ORDER BY sale_date DESC
  `).bind(userId).all();

  const salesWithItems = await Promise.all(sales.results.map(async (sale) => {
    const items = await db.prepare(`
      SELECT * FROM sale_items WHERE sale_id = ?
    `).bind(sale.id).all();
    return { ...sale, items: items.results };
  }));

  return new Response(JSON.stringify(salesWithItems), { headers });
}

async function addSale(request, userId, db, headers) {
  const data = await request.json();
  const saleId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO sales (id, user_id, sale_date, total_revenue, total_items)
    VALUES (?, ?, ?, ?, ?)
  `).bind(saleId, userId, data.date || new Date().toISOString().split('T')[0],
         data.totalRevenue || 0, data.totalItems || 0).run();

  for (const item of (data.items || [])) {
    await db.prepare(`
      INSERT INTO sale_items (sale_id, stock_id, product_name, qty, price)
      VALUES (?, ?, ?, ?, ?)
    `).bind(saleId, item.stockId, item.name, item.qty, item.price).run();

    await db.prepare(`
      UPDATE stock SET sold_qty = sold_qty + ? WHERE id = ?
    `).bind(item.qty, item.stockId).run();

    await checkLowStock(userId, item.stockId, db);
  }

  await db.prepare(`
    INSERT INTO activity (user_id, icon, text) VALUES (?, ?, ?)
  `).bind(userId, '💰', `Sold ${data.totalItems} items for $${data.totalRevenue.toFixed(2)}`).run();

  return new Response(JSON.stringify({ success: true, id: saleId }), { status: 201, headers });
}

// ==================== NOTIFICATION HANDLERS ====================

async function getNotifications(userId, db, headers) {
  const results = await db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(userId).all();

  return new Response(JSON.stringify(results.results), { headers });
}

async function markNotificationsRead(userId, db, headers) {
  await db.prepare(`
    UPDATE notifications SET read = 1 WHERE user_id = ?
  `).bind(userId).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

// ==================== ACTIVITY HANDLER ====================

async function getActivity(userId, db, headers) {
  const results = await db.prepare(`
    SELECT * FROM activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(userId).all();

  return new Response(JSON.stringify(results.results), { headers });
}

async function addActivity(request, userId, db, headers) {
  const { icon, text } = await request.json();
  
  await db.prepare(`
    INSERT INTO activity (user_id, icon, text) VALUES (?, ?, ?)
  `).bind(userId, icon, text).run();

  return new Response(JSON.stringify({ success: true }), { headers });
}

// ==================== REPORTS HANDLER ====================

async function getReports(userId, url, db, headers) {
  const period = url.searchParams.get('period') || 'all';
  
  let dateFilter = '';
  const now = new Date();
  
  switch (period) {
    case 'today':
      dateFilter = `AND sale_date = '${now.toISOString().split('T')[0]}'`;
      break;
    case 'week':
      const weekAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
      dateFilter = `AND sale_date >= '${weekAgo}'`;
      break;
    case 'month':
      const monthAgo = new Date(now - 30 * 86400000).toISOString().split('T')[0];
      dateFilter = `AND sale_date >= '${monthAgo}'`;
      break;
  }

  const salesData = await db.prepare(`
    SELECT SUM(total_revenue) as revenue, SUM(total_items) as sold
    FROM sales WHERE user_id = ? ${dateFilter}
  `).bind(userId).first();

  const transport = await db.prepare(`
    SELECT SUM(trans_go + trans_return) as total
    FROM stock WHERE user_id = ?
  `).bind(userId).first();

  return new Response(JSON.stringify({
    revenue: salesData.revenue || 0,
    sold: salesData.sold || 0,
    profit: (salesData.revenue || 0) * 0.3,
    transport: transport.total || 0
  }), { headers });
}

// ==================== HELPER FUNCTIONS ====================

async function checkLowStock(userId, stockId, db) {
  const stock = await db.prepare(`
    SELECT * FROM stock WHERE id = ?
  `).bind(stockId).first();

  if (!stock) return;

  const user = await db.prepare(`
    SELECT low_stock_threshold FROM users WHERE id = ?
  `).bind(userId).first();

  const threshold = user?.low_stock_threshold || 5;
  const remaining = stock.total_qty - stock.sold_qty;

  if (remaining <= 0) {
    const existing = await db.prepare(`
      SELECT id FROM notifications WHERE user_id = ? AND title LIKE ? AND type = 'critical' AND read = 0
    `).bind(userId, `%${stock.name}%`).first();

    if (!existing) {
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body)
        VALUES (?, ?, 'critical', ?, ?)
      `).bind(
        crypto.randomUUID(), userId,
        `🚨 ${stock.name} is OUT OF STOCK!`,
        `Time to restock ${stock.name}. Current quantity: 0.`
      ).run();
    }
  } else if (remaining <= threshold) {
    const existing = await db.prepare(`
      SELECT id FROM notifications WHERE user_id = ? AND title LIKE ? AND type = 'warning' AND read = 0
    `).bind(userId, `%${stock.name}%`).first();

    if (!existing) {
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body)
        VALUES (?, ?, 'warning', ?, ?)
      `).bind(
        crypto.randomUUID(), userId,
        `⚠️ ${stock.name} is low on stock`,
        `Only ${remaining} units remaining.`
      ).run();
    }
  }
}

async function generatePeriodicNotifications(db) {
  console.log('Generating periodic notifications...');
  
  const users = await db.prepare('SELECT id, notif_frequency, low_stock_threshold FROM users').all();
  
  for (const user of users.results) {
    const threshold = user.low_stock_threshold || 5;
    
    const lowStock = await db.prepare(`
      SELECT name, brand, total_qty, sold_qty, (total_qty - sold_qty) as remaining
      FROM stock
      WHERE user_id = ? AND (total_qty - sold_qty) <= ?
    `).bind(user.id, threshold).all();

    if (lowStock.results.length > 0) {
      const summary = lowStock.results.map(s => 
        `${s.name}: ${s.remaining} left`
      ).join('\n');

      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, body)
        VALUES (?, ?, 'info', ?, ?)
      `).bind(
        crypto.randomUUID(), user.id,
        '📊 Periodic Stock Report',
        `Low stock items:\n${summary}`
      ).run();
    }
  }
  
  console.log('Periodic notifications generated');
}
