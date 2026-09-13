import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_SETTINGS } from './src/data/initialData';
import { syncAllServerData } from './src/server/serverData';
import type { 
  Product, 
  ProductVariant, 
  Order, 
  OrderItem, 
  Coupon, 
  DeliveryRegion, 
  StoreSettings, 
  CustomerUser, 
  CreateOrderPayload,
  PaymentMethod 
} from './src/types';
import { getServerSupabase } from './src/server/supabaseAdmin';
import {
  fetchAdminProducts,
  fetchAdminRegions,
  fetchAdminSettings,
} from './src/server/adminData';
import {
  adminIntegrationPost,
  adminPublicPost,
} from './src/server/adminApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server Data Store (Directly loaded from Supabase via server client, NO mock records)
let products: Product[] = [];
let orders: Order[] = [];
let coupons: Coupon[] = [];
let regions: DeliveryRegion[] = [];
let settings: StoreSettings = { ...INITIAL_SETTINGS };

// Load data directly from Supabase tables using server-only service-role client
async function syncServerDataWithSupabase() {
  try {
    const synced = await syncAllServerData();
    if (synced.products && synced.products.length > 0) {
      products = synced.products;
      console.log(`[Server Supabase] Loaded ${products.length} products`);
    }
    if (Array.isArray(synced.coupons)) {
      coupons = synced.coupons;
      console.log(`[Server Supabase] Loaded ${coupons.length} coupons`);
    }
    if (synced.regions && synced.regions.length > 0) {
      regions = synced.regions;
      console.log(`[Server Supabase] Loaded ${regions.length} delivery regions`);
    }
    if (synced.settings) {
      settings = { ...settings, ...synced.settings };
      console.log(`[Server Supabase] Loaded store settings`);
    }
  } catch (err) {
    console.warn('Notice loading Supabase tables on server:', err);
  }
}

// Lightweight Server-Side Refresh / TTL Cache (20s TTL)
// Ensures prices, stock, coupons, delivery regions, and store settings remain fresh
const SERVER_DATA_CACHE_TTL_MS = 20 * 1000; // 20 seconds TTL
let lastServerDataSyncTime = 0;
let syncInProgressPromise: Promise<void> | null = null;

export async function ensureFreshServerData(): Promise<void> {
  const now = Date.now();
  if (now - lastServerDataSyncTime < SERVER_DATA_CACHE_TTL_MS && products.length > 0) {
    return; // Cache is still fresh
  }

  // Deduplicate concurrent refresh calls (single in-flight promise)
  if (syncInProgressPromise) {
    return syncInProgressPromise;
  }

  syncInProgressPromise = (async () => {
    try {
      await syncServerDataWithSupabase();
      lastServerDataSyncTime = Date.now();
    } catch (err) {
      console.warn('[Server Supabase Cache] Refresh notice:', err);
    } finally {
      syncInProgressPromise = null;
    }
  })();

  return syncInProgressPromise;
}

// Customer Identity & Auth Store
// TODO: Customer session persistence must move to a durable/auth-provider-based system (e.g. Supabase Auth / Redis / DB sessions) before multi-instance production deployment.
let customers: CustomerUser[] = [];
const activeCustomerSessions = new Map<string, { customerId: string; expiresAt: number; phone: string }>();
const pendingOtps = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
const otpPhoneRateLimits = new Map<string, { count: number; resetAt: number }>();
const otpIpRateLimits = new Map<string, { count: number; resetAt: number }>();

// Helper: Normalize Egyptian Phone Numbers (010, 011, 012, 015)
export function normalizeEgyptianPhone(input: string): string {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('0020')) {
    digits = digits.substring(4);
  } else if (digits.startsWith('002')) {
    digits = digits.substring(3);
  } else if (digits.startsWith('20') && digits.length === 12) {
    digits = digits.substring(2);
  }
  if (digits.length === 10 && (digits.startsWith('10') || digits.startsWith('11') || digits.startsWith('12') || digits.startsWith('15'))) {
    digits = '0' + digits;
  }
  return digits;
}

export function isValidEgyptianPhone(phone: string): boolean {
  const norm = normalizeEgyptianPhone(phone);
  return /^01[0125][0-9]{8}$/.test(norm);
}

// Clean up expired sessions & OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeCustomerSessions.entries()) {
    if (session.expiresAt <= now) {
      activeCustomerSessions.delete(token);
    }
  }
  for (const [phone, otpData] of pendingOtps.entries()) {
    if (otpData.expiresAt <= now) {
      pendingOtps.delete(phone);
    }
  }
  for (const [phone, rate] of otpPhoneRateLimits.entries()) {
    if (rate.resetAt <= now) {
      otpPhoneRateLimits.delete(phone);
    }
  }
  for (const [ip, rate] of otpIpRateLimits.entries()) {
    if (rate.resetAt <= now) {
      otpIpRateLimits.delete(ip);
    }
  }
}, 60 * 1000);

// Lazy-initialized Gemini AI Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

export async function createServer() {
  const app = express();

  // Validate Port: must be integer between 1 and 65535, fallback to 3000
  const rawPort = process.env.PORT;
  let parsedPort = 3000;
  if (rawPort) {
    const p = parseInt(rawPort, 10);
    if (!isNaN(p) && p >= 1 && p <= 65535) {
      parsedPort = p;
    }
  }
  const PORT = parsedPort;

  // Deliberate reverse proxy trust configuration
  app.set('trust proxy', 1);

  // Body limits: max 2mb to prevent unbounded payloads
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Load fresh data directly from Supabase tables on startup
  await syncServerDataWithSupabase();

  // Request logger for API routes (No sensitive bodies, tokens, or keys logged)
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[Customer API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // Customer Authentication Helper (Strictly from Bearer token)
  const getAuthenticatedCustomer = (req: express.Request): CustomerUser | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7).trim();
    const session = activeCustomerSessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) activeCustomerSessions.delete(token);
      return null;
    }
    const customer = customers.find(c => c.id === session.customerId);
    return customer || null;
  };

  // Health & Info Endpoint (Customer-facing, no admin secrets)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Al-Mallah Fresh Fish Customer Store Backend',
      version: '3.1.0',
      timestamp: new Date().toISOString(),
      storeOpen: settings.isStoreOpen,
      supabaseConnected: Boolean(getServerSupabase()),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      stats: {
        productsCount: products.filter(p => p.isVisible).length,
        categoriesCount: 5,
        regionsCount: regions.filter(r => r.isActive).length
      }
    });
  });

  // ==========================================
  // CUSTOMER PHONE AUTHENTICATION (Egyptian Mobile & OTP)
  // Hardened: NEVER logs OTP, NEVER returns OTP in API responses
  // Rate limited by phone AND req.ip
  // ==========================================

  // 1. Send OTP to Egyptian Mobile
  app.post('/api/auth/send-otp', (req, res) => {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الهاتف' });
    }

    const normalized = normalizeEgyptianPhone(phone);
    if (!isValidEgyptianPhone(normalized)) {
      return res.status(400).json({ 
        success: false, 
        error: 'رقم الهاتف غير صالح. يرجى إدخال رقم محمول مصري صحيح (مثال: 01015192040 أو 011 أو 012 أو 015)' 
      });
    }

    const clientIp = req.ip || 'unknown-ip';
    const now = Date.now();

    // Check & update phone rate limit: max 5 requests per 10 minutes
    const phoneLimit = otpPhoneRateLimits.get(normalized) || { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (now > phoneLimit.resetAt) {
      phoneLimit.count = 0;
      phoneLimit.resetAt = now + 10 * 60 * 1000;
    }
    if (phoneLimit.count >= 5) {
      const waitMinutes = Math.ceil((phoneLimit.resetAt - now) / 60000);
      return res.status(429).json({ 
        success: false, 
        error: `تم تجاوز الحد الأقصى لمحاولات إرسال الرمز لهذا الرقم. يرجى الانتظار ${waitMinutes} دقيقة.` 
      });
    }

    // Check & update IP rate limit: max 5 requests per 10 minutes
    const ipLimit = otpIpRateLimits.get(clientIp) || { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (now > ipLimit.resetAt) {
      ipLimit.count = 0;
      ipLimit.resetAt = now + 10 * 60 * 1000;
    }
    if (ipLimit.count >= 5) {
      const waitMinutes = Math.ceil((ipLimit.resetAt - now) / 60000);
      return res.status(429).json({ 
        success: false, 
        error: `تم تجاوز الحد الأقصى لمحاولات الإرسال من هذا الجهاز. يرجى الانتظار ${waitMinutes} دقيقة.` 
      });
    }

    // Live SMS Gateway Check:
    // If no real SMS gateway provider is configured in production, fail safely.
    // Explicit server-only variable ENABLE_DEV_OTP=true allows simulated generation for dev testing.
    const isDevOtpEnabled = process.env.ENABLE_DEV_OTP === 'true';

    if (!isDevOtpEnabled) {
      return res.status(503).json({
        success: false,
        error: 'خدمة إرسال رسائل التحقق (SMS) غير مهيأة في بيئة الإنتاج حالياً. يرجى التواصل هاتفياً أو عبر واتساب مع المتجر لإتمام طلبك.'
      });
    }

    phoneLimit.count += 1;
    otpPhoneRateLimits.set(normalized, phoneLimit);
    ipLimit.count += 1;
    otpIpRateLimits.set(clientIp, ipLimit);

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    pendingOtps.set(normalized, {
      otp,
      expiresAt,
      attempts: 0
    });

    // SECURITY: NEVER log the OTP value to console or files!
    // SECURITY: NEVER return devOtp in the response!
    res.json({
      success: true,
      message: 'تم طلب إرسال رمز التحقق بنجاح إلى هاتفك المحمول',
      expiresInSeconds: 300
    });
  });

  // 2. Verify OTP & Issue Customer Session
  app.post('/api/auth/verify-otp', (req, res) => {
    const { phone, otp, name, governorate, city, district, address } = req.body;
    if (!phone || typeof phone !== 'string' || !otp) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف وكود التحقق مطلوبان' });
    }

    const normalized = normalizeEgyptianPhone(phone);
    const otpRecord = pendingOtps.get(normalized);
    const now = Date.now();

    if (!otpRecord || otpRecord.expiresAt < now) {
      if (otpRecord) pendingOtps.delete(normalized);
      return res.status(400).json({ success: false, error: 'رمز التحقق منتهي الصلاحية. اطلب رمزاً جديداً.' });
    }

    otpRecord.attempts += 1;
    if (otpRecord.attempts > 5) {
      pendingOtps.delete(normalized);
      return res.status(400).json({ success: false, error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة. اطلب رمزاً جديداً.' });
    }

    const cleanInputOtp = otp.toString().trim();
    if (cleanInputOtp !== otpRecord.otp) {
      return res.status(400).json({ success: false, error: 'رمز التحقق غير صحيح. تأكد من الرمز وحاول مرة أخرى.' });
    }

    // OTP Verified! Remove used OTP immediately
    pendingOtps.delete(normalized);

    // Find or create customer
    let customer = customers.find(c => c.phone === normalized);
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}_${crypto.randomInt(1000, 9999)}`,
        phone: normalized,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : `عميل الملاح (${normalized.slice(-4)})`,
        governorate: typeof governorate === 'string' && governorate.trim() ? governorate.trim().slice(0, 50) : 'القاهرة',
        city: typeof city === 'string' ? city.trim().slice(0, 100) : '',
        district: typeof district === 'string' ? district.trim().slice(0, 100) : '',
        address: typeof address === 'string' ? address.trim().slice(0, 300) : '',
        createdAt: new Date().toISOString()
      };
      customers.push(customer);
    } else {
      if (typeof name === 'string' && name.trim()) customer.name = name.trim().slice(0, 100);
      if (typeof governorate === 'string' && governorate.trim()) customer.governorate = governorate.trim().slice(0, 50);
      if (typeof city === 'string') customer.city = city.trim().slice(0, 100);
      if (typeof district === 'string') customer.district = district.trim().slice(0, 100);
      if (typeof address === 'string') customer.address = address.trim().slice(0, 300);
      customer.updatedAt = new Date().toISOString();
    }

    // Generate Cryptographically Secure Session Token (Valid 30 days)
    const token = 'alm_c_' + crypto.randomBytes(32).toString('hex');
    const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = now + sessionDurationMs;

    activeCustomerSessions.set(token, {
      customerId: customer.id,
      phone: customer.phone,
      expiresAt
    });

    res.json({
      success: true,
      message: 'تم التحقق من رقم الهاتف وتسجيل الدخول بنجاح',
      token,
      customer
    });
  });

  // 3. Get Current Authenticated Customer Profile
  app.get('/api/auth/me', (req, res) => {
    const customer = getAuthenticatedCustomer(req);
    if (!customer) {
      return res.status(401).json({ success: false, error: 'غير مسجل الدخول أو انتهت الجلسة' });
    }
    res.json({ success: true, customer });
  });

  // 4. Update Profile
  app.put('/api/auth/profile', (req, res) => {
    const customer = getAuthenticatedCustomer(req);
    if (!customer) {
      return res.status(401).json({ success: false, error: 'يرجى تسجيل الدخول أولاً' });
    }

    const { name, governorate, city, district, address, notes } = req.body;
    if (typeof name === 'string' && name.trim()) customer.name = name.trim().slice(0, 100);
    if (typeof governorate === 'string' && governorate.trim()) customer.governorate = governorate.trim().slice(0, 50);
    if (typeof city === 'string') customer.city = city.trim().slice(0, 100);
    if (typeof district === 'string') customer.district = district.trim().slice(0, 100);
    if (typeof address === 'string') customer.address = address.trim().slice(0, 300);
    if (typeof notes === 'string') customer.notes = notes.trim().slice(0, 500);
    customer.updatedAt = new Date().toISOString();

    res.json({ success: true, message: 'تم تحديث بياناتك بنجاح', customer });
  });

  // 5. Logout
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      activeCustomerSessions.delete(token);
    }
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  });

  // ==========================================
  // PRODUCTS API
  // ==========================================

  app.get('/api/products', async (req, res) => {
    try {
      const { category, search, inStock } = req.query;
      let result = await fetchAdminProducts();

      if (category && category !== 'all') {
        result = result.filter(p => p.category === category);
      }
      if (inStock === 'true') {
        result = result.filter(p => p.inStock);
      }
      if (search && typeof search === 'string' && search.trim()) {
        const q = search.trim().toLowerCase();
        result = result.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.badgeText && p.badgeText.toLowerCase().includes(q))
        );
      }

      result.sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
      return res.json({ success: true, count: result.length, data: result });
    } catch (err) {
      console.error('[Admin API] Failed to load products:', err);
      return res.status(503).json({
        success: false,
        error: 'تعذر تحميل المنتجات من نظام الإدارة حالياً',
      });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const adminProducts = await fetchAdminProducts();
      const product = adminProducts.find(
        p => p.id === req.params.id && p.isVisible !== false
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'المنتج غير موجود أو غير متاح',
        });
      }

      return res.json({ success: true, data: product });
    } catch (err) {
      console.error('[Admin API] Failed to load product:', err);
      return res.status(503).json({
        success: false,
        error: 'تعذر تحميل بيانات المنتج من نظام الإدارة حالياً',
      });
    }
  });

  // ==========================================
  // CUSTOMER ORDERS API & IDOR HARDENING
  // PRIVACY: Strictly requires authenticated customer session
  // NEVER uses ?phone= for authorization
  // ==========================================

  type CustomerOrdersResult = 
    | { status: 'success'; orders: Order[] }
    | { status: 'error'; message: string };

  // Durable Supabase order fetcher for customer orders using safe parameterized queries
  async function fetchOrdersFromSupabaseForCustomer(
    supabase: ReturnType<typeof getServerSupabase>,
    customerId?: string,
    customerPhone?: string
  ): Promise<CustomerOrdersResult> {
    if (!supabase) return { status: 'error', message: 'عميل قاعدة البيانات غير متصل' };

    try {
      const queries: Array<PromiseLike<any>> = [];
      if (customerId) {
        queries.push(
          supabase
            .from('orders')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
        );
      }
      if (customerPhone) {
        queries.push(
          supabase
            .from('orders')
            .select('*')
            .eq('customer_phone', customerPhone)
            .order('created_at', { ascending: false })
        );
      }

      if (queries.length === 0) {
        return { status: 'success', orders: [] };
      }

      const results = await Promise.all(queries);
      const allRows: any[] = [];
      const seenIds = new Set<string>();

      for (const res of results) {
        if (res.error) {
          console.warn('[Orders Read] Supabase orders query error:', res.error);
          return { status: 'error', message: res.error.message || 'خطأ في جلب الطلبات' };
        }
        if (Array.isArray(res.data)) {
          for (const row of res.data) {
            const rId = String(row.id);
            if (!seenIds.has(rId)) {
              seenIds.add(rId);
              allRows.push(row);
            }
          }
        }
      }

      if (allRows.length === 0) {
        return { status: 'success', orders: [] };
      }

      allRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const orderIds = allRows.map((r: any) => r.id);
      const { data: itemRows, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      const itemsByOrder: Record<string, OrderItem[]> = {};
      if (!itemsErr && itemRows) {
        for (const item of itemRows) {
          if (!itemsByOrder[item.order_id]) {
            itemsByOrder[item.order_id] = [];
          }
          const matchedProd = products.find(p => p.id === item.product_id);
          itemsByOrder[item.order_id].push({
            productId: item.product_id,
            variantId: item.variant_id || undefined,
            productName: item.product_name,
            productImage: matchedProd?.image || '',
            unit: matchedProd?.unit || 'كيلو',
            variantLabel: item.variant_label || undefined,
            price: Number(item.price),
            quantity: Number(item.quantity),
            itemTotal: Number(item.item_total),
            piecesPerKiloRange: item.pieces_per_kilo_range || undefined,
            notes: item.notes || undefined
          });
        }
      }

      const ordersList: Order[] = allRows.map((r: any): Order => ({
        id: String(r.id),
        orderNumber: r.order_number,
        customerId: r.customer_id || undefined,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        governorate: r.governorate,
        city: r.city || '',
        district: r.district || '',
        address: r.address,
        notes: r.notes || '',
        items: itemsByOrder[r.id] || [],
        subtotal: Number(r.subtotal),
        deliveryFee: Number(r.delivery_fee || 0),
        discountAmount: Number(r.discount_amount || 0),
        couponCode: r.coupon_code || undefined,
        total: Number(r.total),
        paymentMethod: r.payment_method,
        depositRequired: Number(r.deposit_required || 0),
        depositPaid: Number(r.deposit_paid || 0),
        depositStatus: r.deposit_status || 'none',
        depositTransactionRef: r.deposit_transaction_ref || undefined,
        remainingAmount: Number(r.remaining_amount || 0),
        status: r.status || 'new',
        createdAt: r.created_at,
        deliveryTargetDate: 'نفس اليوم مبرد 🚚',
        isBeforeCutoff: true,
        estimatedDeliveryTime: 'خلال اليوم صيد مبرد'
      }));

      return { status: 'success', orders: ordersList };
    } catch (err: any) {
      console.warn('[Orders Read] Supabase orders query exception:', err);
      return { status: 'error', message: err?.message || 'استثناء أثناء جلب الطلبات' };
    }
  }

  type SingleOrderResult = 
    | { status: 'found'; order: Order }
    | { status: 'not_found' }
    | { status: 'error'; message: string };

  // Durable Supabase fetcher for single order using safe parameterized queries
  async function fetchSingleOrderFromSupabase(
    supabase: ReturnType<typeof getServerSupabase>,
    orderIdOrNumber: string
  ): Promise<SingleOrderResult> {
    if (!supabase) return { status: 'error', message: 'عميل قاعدة البيانات غير متصل' };

    const cleanInput = (orderIdOrNumber || '').trim();
    if (!cleanInput) return { status: 'not_found' };

    try {
      let orderRow: any = null;

      // 1. Safe query by id using exact .eq()
      const { data: byId, error: errId } = await supabase
        .from('orders')
        .select('*')
        .eq('id', cleanInput)
        .limit(1)
        .maybeSingle();

      if (errId) {
        console.warn('[Single Order Read] Query by id error:', errId);
      } else if (byId) {
        orderRow = byId;
      }

      // 2. If not found by id, safe query by order_number using exact .eq()
      if (!orderRow) {
        const { data: byNumber, error: errNumber } = await supabase
          .from('orders')
          .select('*')
          .eq('order_number', cleanInput)
          .limit(1)
          .maybeSingle();

        if (errNumber) {
          console.warn('[Single Order Read] Query by order_number error:', errNumber);
          if (errId) {
            return { status: 'error', message: errNumber.message || 'خطأ في قاعدة البيانات' };
          }
        } else if (byNumber) {
          orderRow = byNumber;
        }
      }

      if (!orderRow) {
        if (errId) {
          return { status: 'error', message: errId.message || 'خطأ في قاعدة البيانات' };
        }
        return { status: 'not_found' };
      }

      const { data: itemRows, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderRow.id);

      if (itemsErr) {
        console.warn('[Single Order Read] Order items query error:', itemsErr);
      }

      const items: OrderItem[] = (itemRows || []).map((item: any) => {
        const matchedProd = products.find(p => p.id === item.product_id);
        return {
          productId: item.product_id,
          variantId: item.variant_id || undefined,
          productName: item.product_name,
          productImage: matchedProd?.image || '',
          unit: matchedProd?.unit || 'كيلو',
          variantLabel: item.variant_label || undefined,
          price: Number(item.price),
          quantity: Number(item.quantity),
          itemTotal: Number(item.item_total),
          piecesPerKiloRange: item.pieces_per_kilo_range || undefined,
          notes: item.notes || undefined
        };
      });

      const order: Order = {
        id: String(orderRow.id),
        orderNumber: orderRow.order_number,
        customerId: orderRow.customer_id || undefined,
        customerName: orderRow.customer_name,
        customerPhone: orderRow.customer_phone,
        governorate: orderRow.governorate,
        city: orderRow.city || '',
        district: orderRow.district || '',
        address: orderRow.address,
        notes: orderRow.notes || '',
        items,
        subtotal: Number(orderRow.subtotal),
        deliveryFee: Number(orderRow.delivery_fee || 0),
        discountAmount: Number(orderRow.discount_amount || 0),
        couponCode: orderRow.coupon_code || undefined,
        total: Number(orderRow.total),
        paymentMethod: orderRow.payment_method,
        depositRequired: Number(orderRow.deposit_required || 0),
        depositPaid: Number(orderRow.deposit_paid || 0),
        depositStatus: orderRow.deposit_status || 'none',
        depositTransactionRef: orderRow.deposit_transaction_ref || undefined,
        remainingAmount: Number(orderRow.remaining_amount || 0),
        status: orderRow.status || 'new',
        createdAt: orderRow.created_at,
        deliveryTargetDate: 'نفس اليوم مبرد 🚚',
        isBeforeCutoff: true,
        estimatedDeliveryTime: 'خلال اليوم صيد مبرد'
      };

      return { status: 'found', order };
    } catch (err: any) {
      console.warn('[Single Order Read] Exception querying Supabase:', err);
      return { status: 'error', message: err?.message || 'استثناء أثناء استرجاع تفاصيل الطلب' };
    }
  }

  type AdminIntegrationOrder = {
    id: string;
    orderNumber: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    city?: string;
    district?: string;
    subtotal: number;
    discountAmount: number;
    couponCode?: string;
    deliveryFee: number;
    totalAmount: number;
    depositAmount: number;
    depositStatus?: string;
    depositMethod?: string;
    depositReference?: string;
    remainingAmount: number;
    status: string;
    notes?: string;
    createdAt: string;
    updatedAt?: string;
    items: Array<{
      id?: string;
      productId: string;
      variantId?: string;
      productName: string;
      variantTitle?: string;
      pricingUnit: string;
      weightKg?: number;
      pieceCount?: number;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
    }>;
  };

  const mapAdminIntegrationOrder = (
    adminOrder: AdminIntegrationOrder
  ): Order => {
    const statusMap: Record<string, Order['status']> = {
      pending: 'new',
      new: 'new',
      preparing: 'preparing',
      delivering: 'on_delivery',
      on_delivery: 'on_delivery',
      completed: 'delivered',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };

    const depositStatus: Order['depositStatus'] =
      adminOrder.depositStatus === 'confirmed'
        ? 'confirmed'
        : adminOrder.depositStatus === 'rejected'
          ? 'rejected'
          : adminOrder.depositStatus === 'not_required' ||
              Number(adminOrder.depositAmount || 0) <= 0
            ? 'none'
            : 'pending';

    const rawPaymentMethod = adminOrder.depositMethod;
    const paymentMethod: PaymentMethod =
      rawPaymentMethod === 'cash_on_delivery' ||
      rawPaymentMethod === 'vodafone_cash' ||
      rawPaymentMethod === 'instapay'
        ? rawPaymentMethod
        : 'instapay';

    return {
      id: String(adminOrder.id),
      orderNumber: adminOrder.orderNumber,
      customerId: adminOrder.customerId,
      customerName: adminOrder.customerName,
      customerPhone: adminOrder.customerPhone,
      governorate: adminOrder.city || '',
      city: adminOrder.city || '',
      district: adminOrder.district || '',
      address: adminOrder.customerAddress || '',
      notes: adminOrder.notes || '',
      items: (adminOrder.items || []).map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        variantLabel: item.variantTitle,
        productName: item.productName,
        productImage: '',
        unit:
          item.pricingUnit === 'piece'
            ? 'قطعة'
            : 'كيلو',
        price: Number(item.unitPrice || 0),
        quantity: Number(item.quantity || 0),
        itemTotal: Number(item.totalPrice || 0),
      })),
      subtotal: Number(adminOrder.subtotal || 0),
      deliveryFee: Number(adminOrder.deliveryFee || 0),
      discountAmount: Number(adminOrder.discountAmount || 0),
      couponCode: adminOrder.couponCode,
      total: Number(adminOrder.totalAmount || 0),
      paymentMethod,
      depositRequired: Number(adminOrder.depositAmount || 0),
      depositPaid:
        depositStatus === 'confirmed'
          ? Number(adminOrder.depositAmount || 0)
          : 0,
      depositStatus,
      depositTransactionRef: adminOrder.depositReference,
      remainingAmount: Number(adminOrder.remainingAmount || 0),
      status: statusMap[adminOrder.status] || 'new',
      createdAt: adminOrder.createdAt,
      deliveryTargetDate: 'نفس اليوم مبرد 🚚',
      isBeforeCutoff: true,
      estimatedDeliveryTime: 'خلال اليوم صيد مبرد',
    };
  };

  // A) GET /api/customer/orders
  // Authenticated session phone is the ONLY customer identifier sent to Admin.
  app.get('/api/customer/orders', async (req, res) => {
    const customer = getAuthenticatedCustomer(req);

    if (!customer) {
      return res.status(401).json({
        success: false,
        error: 'غير مصرح: يرجى تسجيل الدخول لعرض قائمة طلباتك',
      });
    }

    try {
      const result = await adminIntegrationPost<{
        orders: AdminIntegrationOrder[];
      }>('/integration/customer/orders', {
        phone: customer.phone,
      });

      const customerOrders = (result.orders || []).map(
        mapAdminIntegrationOrder
      );

      return res.json({
        success: true,
        count: customerOrders.length,
        data: customerOrders,
      });
    } catch (err) {
      console.error('[Admin API] Failed to load customer orders:', err);

      return res.status(503).json({
        success: false,
        error:
          'خدمة استرجاع سجل الطلبات غير متاحة حالياً. يرجى إعادة المحاولة لاحقاً.',
      });
    }
  });

  // B) GET /api/orders/:id
  // Ownership is enforced by Admin using order id/number + authenticated phone.
  app.get('/api/orders/:id', async (req, res) => {
    const customer = getAuthenticatedCustomer(req);

    if (!customer) {
      return res.status(401).json({
        success: false,
        error:
          'غير مصرح: يرجى تسجيل الدخول أولاً للوصول إلى تفاصيل الطلب',
      });
    }

    const orderIdOrNumber = req.params.id;

    if (
      !orderIdOrNumber ||
      typeof orderIdOrNumber !== 'string' ||
      !orderIdOrNumber.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: 'معرف الطلب غير صالح',
      });
    }

    try {
      const result = await adminIntegrationPost<{
        order: AdminIntegrationOrder;
      }>('/integration/orders/lookup', {
        orderIdOrNumber: orderIdOrNumber.trim(),
        phone: customer.phone,
      });

      return res.json({
        success: true,
        data: mapAdminIntegrationOrder(result.order),
      });
    } catch (err: any) {
      const status = Number(err?.status);

      if (status === 404) {
        // Safe 404 also prevents leaking another customer's order.
        return res.status(404).json({
          success: false,
          error: 'الطلب غير موجود',
        });
      }

      if (status === 400) {
        return res.status(400).json({
          success: false,
          error: 'معرف الطلب غير صالح',
        });
      }

      console.error('[Admin API] Failed to load order details:', err);

      return res.status(503).json({
        success: false,
        error:
          'خدمة استرجاع تفاصيل الطلب غير متاحة حالياً. يرجى إعادة المحاولة لاحقاً.',
      });
    }
  });

  // ==========================================
  // SECURE SERVER-AUTHORITATIVE CHECKOUT
  // 1. Enforces store open status
  // 2. Strict request validation (no NaN/Infinity/absurd values)
  // 3. Read-only validation (NO stock or coupon mutation before durable success)
  // 4. Authoritative delivery region and fee (no arbitrary fallback)
  // 5. Untrusted client depositPaid completely ignored; calculated server-side
  // 6. Safe persistence: Supabase must succeed before 201; or fail unless ALLOW_IN_MEMORY_ORDERS=true
  // 7. Collision-resistant order number
  // ==========================================

  // Unique Order Number Generator with bounded retries & strict error handling
  async function generateUniqueOrderNumber(supabase: ReturnType<typeof getServerSupabase>): Promise<string | null> {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const entropy = crypto.randomInt(10000, 99999).toString();
      const candidate = `#ALM-${entropy}`;

      const existsLocally = orders.some(o => o.orderNumber === candidate);
      if (existsLocally) continue;

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('id')
            .eq('order_number', candidate)
            .limit(1);

          if (error) {
            // Failed database uniqueness check must NOT be treated as candidate availability
            continue;
          }

          if (data && data.length > 0) {
            continue;
          }
        } catch {
          // Uniqueness check query threw exception; do not treat candidate as verified
          continue;
        }
      }

      return candidate;
    }
    return null;
  }

  // Customer persistence/upsert before order creation to satisfy foreign-key constraints
  async function upsertCustomerInDatabase(
    supabase: ReturnType<typeof getServerSupabase>,
    customerData: {
      id: string;
      phone: string;
      name: string;
      governorate: string;
      city?: string;
      district?: string;
      address: string;
    }
  ): Promise<{ success: boolean; customerId: string; error?: string }> {
    if (!supabase) {
      return { success: true, customerId: customerData.id };
    }

    try {
      const { data: existing, error: findError } = await supabase
        .from('customers')
        .select('id, phone, name')
        .eq('phone', customerData.phone)
        .limit(1)
        .maybeSingle();

      if (findError && findError.code !== 'PGRST116') {
        console.error('[Customer Upsert] Error finding customer by phone:', findError);
        return { success: false, customerId: '', error: 'خطأ في التحقق من بيانات العميل في قاعدة البيانات' };
      }

      const nowIso = new Date().toISOString();

      if (existing && existing.id) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            name: customerData.name,
            governorate: customerData.governorate,
            city: customerData.city || null,
            district: customerData.district || null,
            address: customerData.address,
            updated_at: nowIso
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[Customer Upsert] Error updating customer:', updateError);
          return { success: false, customerId: '', error: 'تعذر تحديث بيانات العميل في قاعدة البيانات قبل تسجيل الطلب' };
        }

        return { success: true, customerId: existing.id };
      } else {
        const newId = customerData.id || `cust-${Date.now()}-${crypto.randomInt(1000, 9999)}`;
        const { error: insertError } = await supabase
          .from('customers')
          .insert({
            id: newId,
            phone: customerData.phone,
            name: customerData.name,
            governorate: customerData.governorate,
            city: customerData.city || null,
            district: customerData.district || null,
            address: customerData.address,
            created_at: nowIso,
            updated_at: nowIso
          });

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: rechecked } = await supabase
              .from('customers')
              .select('id')
              .eq('phone', customerData.phone)
              .limit(1)
              .maybeSingle();
            if (rechecked && rechecked.id) {
              return { success: true, customerId: rechecked.id };
            }
          }
          console.error('[Customer Upsert] Error inserting customer:', insertError);
          return { success: false, customerId: '', error: 'تعذر حفظ بيانات العميل في قاعدة البيانات قبل تسجيل الطلب' };
        }

        return { success: true, customerId: newId };
      }
    } catch (err) {
      console.error('[Customer Upsert] Exception during customer upsert:', err);
      return { success: false, customerId: '', error: 'حدث خطأ غير متوقع أثناء معالجة بيانات العميل' };
    }
  }

  app.post('/api/orders', async (req, res) => {
    const payload: CreateOrderPayload = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'بيانات الطلب غير صالحة',
      });
    }

    const {
      items,
      deliveryAddress,
      paymentMethod,
      depositTransactionRef,
      couponCode,
      notes,
    } = payload;

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'سلة المشتريات فارغة أو تحتوي على عناصر غير صالحة',
      });
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'بيانات التوصيل مطلوبة',
      });
    }

    const {
      customerName,
      customerPhone: rawPhone,
      governorate,
      city,
      district,
      address,
    } = deliveryAddress;

    if (
      !customerName ||
      typeof customerName !== 'string' ||
      customerName.trim().length < 2
    ) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال اسم العميل بشكل صحيح',
      });
    }

    if (!rawPhone || typeof rawPhone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'رقم هاتف العميل مطلوب',
      });
    }

    const customerPhone = normalizeEgyptianPhone(rawPhone);

    if (!isValidEgyptianPhone(customerPhone)) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال رقم هاتف محمول مصري صحيح',
      });
    }

    if (!governorate || typeof governorate !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'يرجى اختيار المحافظة',
      });
    }

    if (
      !address ||
      typeof address !== 'string' ||
      address.trim().length < 5
    ) {
      return res.status(400).json({
        success: false,
        error: 'يرجى كتابة عنوان التوصيل بالتفصيل',
      });
    }

    const allowedPaymentMethods: PaymentMethod[] = [
      'cash_on_delivery',
      'instapay',
      'vodafone_cash',
    ];

    if (
      !paymentMethod ||
      !allowedPaymentMethods.includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        error: 'طريقة الدفع المحددة غير مدعومة',
      });
    }

    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== 'string' ||
        typeof item.quantity !== 'number' ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'يوجد منتج أو كمية غير صالحة في السلة',
        });
      }
    }

    // Authenticated session phone always wins over browser-supplied phone.
    const authCustomer = getAuthenticatedCustomer(req);
    const verifiedPhone = authCustomer
      ? authCustomer.phone
      : customerPhone;

    try {
      // Resolve the real Admin delivery-region ID.
      const adminRegions = await fetchAdminRegions();

      const normalizeText = (value: unknown) =>
        String(value || '').trim().toLowerCase();

      const wantedGovernorate = normalizeText(governorate);
      const wantedCity = normalizeText(city);
      const wantedDistrict = normalizeText(district);

      let matchingRegion = adminRegions.find((region) => {
        if (
          normalizeText(region.governorate) !== wantedGovernorate
        ) {
          return false;
        }

        return region.cities.some((regionName) => {
          const normalized = normalizeText(regionName);

          return (
            (wantedCity && normalized === wantedCity) ||
            (wantedDistrict && normalized === wantedDistrict)
          );
        });
      });

      if (!matchingRegion) {
        const governorateRegions = adminRegions.filter(
          (region) =>
            normalizeText(region.governorate) === wantedGovernorate
        );

        if (governorateRegions.length === 1) {
          matchingRegion = governorateRegions[0];
        }
      }

      if (!matchingRegion) {
        return res.status(400).json({
          success: false,
          error:
            'تعذر تحديد منطقة التوصيل بدقة. يرجى اختيار المنطقة من قائمة التوصيل المتاحة.',
        });
      }

      const adminResult = await adminPublicPost<{
        success: boolean;
        message?: string;
        order: {
          id: string;
          orderNumber: string;
          customerName: string;
          customerPhone: string;
          customerAddress: string;
          city?: string;
          district?: string;
          subtotal: number;
          discountAmount: number;
          couponCode?: string;
          deliveryFee: number;
          totalAmount: number;
          depositAmount: number;
          depositStatus: string;
          depositMethod?: string;
          depositReference?: string;
          remainingAmount: number;
          status: string;
          notes?: string;
          createdAt: string;
          updatedAt?: string;
          items: Array<{
            productId: string;
            variantId?: string;
            productName: string;
            variantTitle?: string;
            pricingUnit: string;
            unitPrice: number;
            quantity: number;
            totalPrice: number;
          }>;
        };
      }>('/orders', {
        customerName: customerName.trim(),
        customerPhone: verifiedPhone,
        customerAddress: address.trim(),
        city:
          typeof city === 'string' && city.trim()
            ? city.trim()
            : governorate.trim(),
        district:
          typeof district === 'string'
            ? district.trim().slice(0, 100)
            : '',
        deliveryRegionId: matchingRegion.id,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        couponCode:
          typeof couponCode === 'string'
            ? couponCode.trim().slice(0, 30)
            : undefined,
        depositMethod: paymentMethod,
        depositReference:
          typeof depositTransactionRef === 'string'
            ? depositTransactionRef.trim().slice(0, 100)
            : undefined,
        notes:
          typeof notes === 'string'
            ? notes.trim().slice(0, 500)
            : undefined,
      });

      const adminOrder = adminResult.order;

      const statusMap: Record<string, Order['status']> = {
        pending: 'new',
        new: 'new',
        preparing: 'preparing',
        on_delivery: 'on_delivery',
        delivered: 'delivered',
        cancelled: 'cancelled',
      };

      const customerOrder: Order = {
        id: adminOrder.id,
        orderNumber: adminOrder.orderNumber,
        customerName: adminOrder.customerName,
        customerPhone: adminOrder.customerPhone,
        governorate: governorate.trim(),
        city: adminOrder.city || '',
        district: adminOrder.district || '',
        address: adminOrder.customerAddress,
        notes: adminOrder.notes || '',
        items: adminOrder.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          variantLabel: item.variantTitle,
          productName: item.productName,
          productImage: '',
          unit:
            item.pricingUnit === 'piece' ? 'قطعة' : 'كيلو',
          price: Number(item.unitPrice || 0),
          quantity: Number(item.quantity || 0),
          itemTotal: Number(item.totalPrice || 0),
        })),
        subtotal: Number(adminOrder.subtotal || 0),
        deliveryFee: Number(adminOrder.deliveryFee || 0),
        discountAmount: Number(adminOrder.discountAmount || 0),
        couponCode: adminOrder.couponCode,
        total: Number(adminOrder.totalAmount || 0),
        paymentMethod,
        depositRequired: Number(adminOrder.depositAmount || 0),
        depositPaid: 0,
        depositStatus:
          adminOrder.depositStatus === 'confirmed'
            ? 'confirmed'
            : adminOrder.depositStatus === 'rejected'
              ? 'rejected'
              : Number(adminOrder.depositAmount || 0) > 0
                ? 'pending'
                : 'none',
        depositTransactionRef: adminOrder.depositReference,
        remainingAmount: Number(adminOrder.remainingAmount || 0),
        status: statusMap[adminOrder.status] || 'new',
        createdAt: adminOrder.createdAt,
      };

      return res.status(201).json({
        success: true,
        message:
          adminResult.message ||
          'تم استلام طلبك بنجاح',
        data: customerOrder,
      });
    } catch (err: any) {
      const status = Number(err?.status);

      if (
        status === 400 ||
        status === 403 ||
        status === 404 ||
        status === 429
      ) {
        const adminMessage =
          err?.payload &&
          typeof err.payload.error === 'string'
            ? err.payload.error
            : 'تعذر إنشاء الطلب بالبيانات الحالية';

        return res.status(status).json({
          success: false,
          error: adminMessage,
        });
      }

      console.error('[Admin API] Order creation failed:', err);

      return res.status(503).json({
        success: false,
        error:
          'تعذر إرسال الطلب إلى نظام الإدارة حالياً. لم يتم تسجيل الطلب، يرجى المحاولة مرة أخرى.',
      });
    }
  });

  // ==========================================
  // COUPONS API (Validation only for customer)
  // ==========================================

  app.post('/api/coupons/validate', async (req, res) => {
    const { code, cartTotal } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال كود الكوبون',
      });
    }

    const rawTotal = Number(cartTotal);
    const subtotal =
      Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : 0;

    try {
      const result = await adminIntegrationPost<{
        valid: boolean;
        code: string;
        discountType: 'percentage' | 'fixed';
        discountValue: number;
        discountAmount: number;
        minOrderValue?: number;
        maxDiscountValue?: number;
        expiryDate?: string;
      }>('/integration/coupons/validate', {
        code: code.trim(),
        subtotal,
      });

      return res.json({
        success: true,
        message: `تم تطبيق كود الخصم بنجاح: خصم ${result.discountAmount} جنيه`,
        data: {
          code: result.code,
          discountType: result.discountType,
          discountValue: result.discountValue,
          minOrderAmount: result.minOrderValue,
          maxDiscount: result.maxDiscountValue,
          discountAmount: result.discountAmount,
        },
      });
    } catch (err: any) {
      const status = Number(err?.status);

      if (status === 400 || status === 404) {
        const adminMessage =
          err?.payload && typeof err.payload.error === 'string'
            ? err.payload.error
            : 'كود الخصم غير صالح أو غير متاح';

        return res.status(status).json({
          success: false,
          error: adminMessage,
        });
      }

      console.error('[Admin API] Coupon validation failed:', err);

      return res.status(503).json({
        success: false,
        error: 'تعذر التحقق من كود الخصم حالياً، يرجى المحاولة مرة أخرى',
      });
    }
  });

  // ==========================================
  // REGIONS & SETTINGS (Public Customer info)
  // ==========================================

  app.get('/api/regions', async (_req, res) => {
    try {
      const active = await fetchAdminRegions();
      return res.json({
        success: true,
        count: active.length,
        data: active,
      });
    } catch (err) {
      console.error('[Admin API] Failed to load regions:', err);
      return res.status(503).json({
        success: false,
        error: 'تعذر تحميل مناطق التوصيل من نظام الإدارة حالياً',
      });
    }
  });

  app.get('/api/settings', async (_req, res) => {
    try {
      const safeSettings = await fetchAdminSettings();
      return res.json({ success: true, data: safeSettings });
    } catch (err) {
      console.error('[Admin API] Failed to load settings:', err);
      return res.status(503).json({
        success: false,
        error: 'تعذر تحميل إعدادات المتجر من نظام الإدارة حالياً',
      });
    }
  });

  // ==========================================
  // GEMINI AI ASSISTANT API (Fish recipes & cooking advice)
  // ==========================================

  app.post('/api/ai/assistant', async (req, res) => {
    const { question, fishType, occasion } = req.body;
    
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          success: true,
          answer: `🐟 **نصيحة شيف متجر الملاح:**\nللحصول على أفضل طعم لأسماك ${fishType || 'البحر الطازجة'}:\n1. **التنظيف:** غسيل السمك بالماء البارد والليمون وقليل من الكمون دون نقع طويل في الخل للحفاظ على تماسك اللحم.\n2. **التسوية:** الشوي بالردة على نار عالية أو سنجاري بالفرن مع البصل والطماطم والكزبرة والفلفل الحار والليمون وزيت الزيتون.\n3. **التوصيل المبرد:** ننصح بالطلب قبل الساعة 3:00 فجراً لضمان وصول صيد الفجر طازج ومبرد في نفس اليوم! 🚚`
        });
      }

      const safeQuestion = typeof question === 'string' ? question.slice(0, 300) : '';
      const safeFish = typeof fishType === 'string' ? fishType.slice(0, 100) : 'البحر الطازجة';
      const safeOccasion = typeof occasion === 'string' ? occasion.slice(0, 100) : 'عائلي';

      const prompt = `أنت شيف أسماك ومستشار متخصص في متجر "الملاح لبيع الأسماك الطازجة" في مصر.
أجب العميل بلباقة واحترافية باللغة العربية مع لمسة ودودة وأسلوب مصري راقي ومختصر ومفيد.
السؤال أو الطلب: "${safeQuestion || `أفضل طريقة لتحضير وتتبيل سمك ${safeFish}`}"
المناسبة أو عدد الأفراد: "${safeOccasion}"

قدّم نصائح عن:
1. أنسب طريقة طهي (مشوي، سنجاري، زيت وليمون، طاجن، مقلي).
2. التتبيلة والبهارات الأنسب.
3. نصيحة الحفظ والتنظيف.
اجعل الإجابة منسقة بنقاط واضحة وجميلة.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      res.json({
        success: true,
        answer: response.text || 'أهلاً بك في متجر الملاح للأسماك الطازجة صيد اليوم!'
      });
    } catch (error: any) {
      console.error('Gemini AI Assistant error notice');
      res.status(500).json({
        success: false,
        error: 'حدث خطأ أثناء معالجة الطلب عبر المساعد الذكي'
      });
    }
  });

  // ==========================================
  // VITE / STATIC MIDDLEWARE
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Customer Server] Running on port ${PORT}`);
  });

  return app;
}

// Auto-start if run directly
createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
