import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { 
  fetchProductsFromSupabase,
  fetchCouponsFromSupabase,
  fetchDeliveryRegionsFromSupabase,
  fetchStoreSettingsFromSupabase,
  INITIAL_SETTINGS 
} from './src/data/initialData';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server Data Store (Directly loaded from Supabase, NO mock records)
let products: Product[] = [];
let orders: Order[] = [];
let coupons: Coupon[] = [];
let regions: DeliveryRegion[] = [];
let settings: StoreSettings = { ...INITIAL_SETTINGS };

// Load data directly from Supabase tables
async function syncServerDataWithSupabase() {
  try {
    const [prodList, couponList, regionList, storeSettings] = await Promise.allSettled([
      fetchProductsFromSupabase(),
      fetchCouponsFromSupabase(),
      fetchDeliveryRegionsFromSupabase(),
      fetchStoreSettingsFromSupabase()
    ]);

    if (prodList.status === 'fulfilled' && prodList.value.length > 0) {
      products = prodList.value;
      console.log(`[Supabase] Loaded ${products.length} products`);
    }
    if (couponList.status === 'fulfilled' && couponList.value.length > 0) {
      coupons = couponList.value;
      console.log(`[Supabase] Loaded ${coupons.length} coupons`);
    }
    if (regionList.status === 'fulfilled' && regionList.value.length > 0) {
      regions = regionList.value;
      console.log(`[Supabase] Loaded ${regions.length} delivery regions`);
    }
    if (storeSettings.status === 'fulfilled' && storeSettings.value) {
      settings = { ...settings, ...storeSettings.value };
      console.log(`[Supabase] Loaded store settings`);
    }
  } catch (err) {
    console.warn('Notice loading Supabase tables on server startup:', err);
  }
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

    // Check & update IP rate limit: max 10 requests per 10 minutes
    const ipLimit = otpIpRateLimits.get(clientIp) || { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (now > ipLimit.resetAt) {
      ipLimit.count = 0;
      ipLimit.resetAt = now + 10 * 60 * 1000;
    }
    if (ipLimit.count >= 10) {
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
    const { category, search, inStock } = req.query;
    let result = products.filter(p => p.isVisible !== false);

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
    res.json({ success: true, count: result.length, data: result });
  });

  app.get('/api/products/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id && p.isVisible !== false);
    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود أو غير متاح' });
    }
    res.json({ success: true, data: product });
  });

  // ==========================================
  // CUSTOMER ORDERS API & IDOR HARDENING
  // PRIVACY: Strictly requires authenticated customer session
  // NEVER uses ?phone= for authorization
  // ==========================================

  // A) GET /api/customer/orders: Strictly restricted to authenticated customer
  app.get('/api/customer/orders', (req, res) => {
    const customer = getAuthenticatedCustomer(req);
    if (!customer) {
      return res.status(401).json({ 
        success: false, 
        error: 'غير مصرح: يرجى تسجيل الدخول لعرض قائمة طلباتك' 
      });
    }

    // Authorize ONLY by customer ID or trusted normalized phone from session
    const myOrders = orders.filter(o => {
      const matchId = o.customerId && o.customerId === customer.id;
      const matchPhone = o.customerPhone && normalizeEgyptianPhone(o.customerPhone) === customer.phone;
      return matchId || matchPhone;
    });

    myOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, count: myOrders.length, data: myOrders });
  });

  // B) GET /api/orders/:id: Strictly authenticated and ownership-verified
  app.get('/api/orders/:id', (req, res) => {
    const customer = getAuthenticatedCustomer(req);
    if (!customer) {
      return res.status(401).json({ 
        success: false, 
        error: 'غير مصرح: يرجى تسجيل الدخول أولاً للوصول إلى تفاصيل الطلب' 
      });
    }

    const orderId = req.params.id;
    const order = orders.find(o => o.id === orderId || o.orderNumber === orderId);

    // Return safe 404 if order does not exist OR if customer does not own it (IDOR protection)
    if (!order) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    const orderPhone = normalizeEgyptianPhone(order.customerPhone);
    const isOwner = (order.customerId && order.customerId === customer.id) || (orderPhone === customer.phone);

    if (!isOwner) {
      // Safe 404: Never disclose whether another customer's order exists
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    res.json({ success: true, data: order });
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

  // Unique Order Number Generator with bounded retries
  async function generateUniqueOrderNumber(supabase: ReturnType<typeof getServerSupabase>): Promise<string> {
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
            .eq('id', candidate)
            .limit(1);
          if (!error && data && data.length > 0) {
            continue;
          }
        } catch {
          // Proceed
        }
      }

      return candidate;
    }
    return `#ALM-${Date.now().toString().slice(-6)}`;
  }

  app.post('/api/orders', async (req, res) => {
    // 1. STORE CLOSED ENFORCEMENT
    if (settings.isStoreOpen === false) {
      return res.status(403).json({
        success: false,
        error: 'المتجر مغلق حالياً ولا يستقبل طلبات جديدة في الوقت الحالي. يمكنك تصفح الأصناف وسنعاود استقبال الطلبات قريباً.'
      });
    }

    const payload: CreateOrderPayload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'بيانات الطلب غير صالحة' });
    }

    const { items, deliveryAddress, paymentMethod, depositTransactionRef, couponCode, notes } = payload;

    // 2. BASIC REQUEST VALIDATION
    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ success: false, error: 'سلة المشتريات فارغة أو تحتوي على عناصر غير صالحة' });
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'object') {
      return res.status(400).json({ success: false, error: 'بيانات التوصيل مطلوبة' });
    }

    const { customerName, customerPhone: rawPhone, governorate, city, district, address } = deliveryAddress;

    if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2 || customerName.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم العميل بشكل صحيح (بين 2 و 100 حرف)' });
    }

    if (!rawPhone || typeof rawPhone !== 'string') {
      return res.status(400).json({ success: false, error: 'رقم هاتف العميل مطلوب' });
    }

    const customerPhone = normalizeEgyptianPhone(rawPhone);
    if (!isValidEgyptianPhone(customerPhone)) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم هاتف محمول مصري صحيح (مثال: 01015192040)' });
    }

    if (!governorate || typeof governorate !== 'string' || governorate.trim().length < 2 || governorate.trim().length > 50) {
      return res.status(400).json({ success: false, error: 'يرجى اختيار المحافظة بشكل صحيح' });
    }

    if (!address || typeof address !== 'string' || address.trim().length < 5 || address.trim().length > 300) {
      return res.status(400).json({ success: false, error: 'يرجى كتابة العنوان بالتفصيل (بين 5 و 300 حرف)' });
    }

    // Payment Method Whitelist
    const allowedPaymentMethods: PaymentMethod[] = ['cash_on_delivery', 'instapay', 'vodafone_cash'];
    if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'طريقة الدفع المحددة غير مدعومة' });
    }

    // Bounded optional fields
    const safeNotes = typeof notes === 'string' ? notes.trim().slice(0, 500) : '';
    const safeCouponCode = typeof couponCode === 'string' ? couponCode.trim().slice(0, 30) : undefined;
    const safeTransactionRef = typeof depositTransactionRef === 'string' ? depositTransactionRef.trim().slice(0, 100) : undefined;

    // 3. CUSTOMER IDENTITY BINDING (Auth Session takes precedence)
    const authCustomer = getAuthenticatedCustomer(req);
    let customerId: string;
    let verifiedPhone: string;

    if (authCustomer) {
      customerId = authCustomer.id;
      verifiedPhone = authCustomer.phone; // Session phone is trusted
    } else {
      verifiedPhone = customerPhone;
      const existing = customers.find(c => c.phone === verifiedPhone);
      if (existing) {
        customerId = existing.id;
      } else {
        const newCust: CustomerUser = {
          id: `cust_${Date.now()}_${crypto.randomInt(1000, 9999)}`,
          phone: verifiedPhone,
          name: customerName.trim(),
          governorate: governorate.trim(),
          city: typeof city === 'string' ? city.trim().slice(0, 100) : '',
          district: typeof district === 'string' ? district.trim().slice(0, 100) : '',
          address: address.trim(),
          createdAt: new Date().toISOString()
        };
        customers.push(newCust);
        customerId = newCust.id;
      }
    }

    // 4. READ-ONLY ITEM VALIDATION & PRICING
    // Strictly NO stock mutations during validation
    let calculatedSubtotal = 0;
    const verifiedOrderItems: OrderItem[] = [];

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ success: false, error: 'بيانات أحد المنتجات في السلة غير صالحة' });
      }

      if (!item.productId || typeof item.productId !== 'string' || item.productId.length > 100) {
        return res.status(400).json({ success: false, error: 'معرف المنتج غير صالح' });
      }

      // Quantity validation: reject NaN, Infinity, negative, zero, and absurd numbers
      const rawQty = item.quantity;
      if (typeof rawQty !== 'number' || !Number.isFinite(rawQty) || rawQty <= 0 || rawQty > 100) {
        return res.status(400).json({ success: false, error: `كمية غير صالحة للمنتج (${item.productId}). يجب أن تكون رقماً موجباً حتى 100.` });
      }
      const qty = Math.round(rawQty * 10) / 10;

      const product = products.find(p => p.id === item.productId);
      if (!product || product.isVisible === false) {
        return res.status(400).json({ success: false, error: `المنتج المختار غير متاح حالياً (${item.productId})` });
      }

      if (!product.inStock) {
        return res.status(400).json({ success: false, error: `سمك ${product.name} غير متوفر في المخزون حالياً` });
      }

      let finalPrice = product.price;
      let variantLabel: string | undefined = undefined;
      let pieceRange = product.piecesPerKiloRange;

      if (item.variantId) {
        if (typeof item.variantId !== 'string' || item.variantId.length > 100) {
          return res.status(400).json({ success: false, error: 'معرف خيار البيع غير صالح' });
        }
        if (product.variants && product.variants.length > 0) {
          const variant = product.variants.find(v => v.id === item.variantId);
          if (variant && variant.isActive) {
            finalPrice = variant.price;
            variantLabel = variant.label;
            pieceRange = `${variant.pieceCount} قطع تقريباً في الكيلو`;
          }
        }
      }

      const itemTotal = finalPrice * qty;
      calculatedSubtotal += itemTotal;

      verifiedOrderItems.push({
        productId: product.id,
        variantId: item.variantId,
        variantLabel,
        productName: product.name,
        productImage: product.image,
        unit: product.unit,
        price: finalPrice,
        quantity: qty,
        itemTotal,
        piecesPerKiloRange: pieceRange,
        notes: typeof item.notes === 'string' ? item.notes.trim().slice(0, 200) : undefined
      });
    }

    // 5. AUTHORITATIVE DELIVERY REGION & FEE
    // Only allow delivery to a configured active region, reject safely otherwise
    const matchingRegion = regions.find(r => 
      r.isActive && 
      r.governorate.trim().toLowerCase() === governorate.trim().toLowerCase()
    );

    if (!matchingRegion) {
      return res.status(400).json({
        success: false,
        error: `عذراً، خدمة التوصيل غير متاحة حالياً لمحافظة ${governorate}. يرجى اختيار محافظة ضمن نطاق التوصيل المتاح.`
      });
    }

    const deliveryFee = matchingRegion.deliveryFee;
    if (typeof deliveryFee !== 'number' || !Number.isFinite(deliveryFee) || deliveryFee < 0) {
      return res.status(500).json({
        success: false,
        error: 'تعذر تحديد رسوم التوصيل لهذه المنطقة حالياً'
      });
    }

    if (matchingRegion.minOrderAmount && calculatedSubtotal < matchingRegion.minOrderAmount) {
      return res.status(400).json({
        success: false,
        error: `الحد الأدنى للطلب في منطقة ${matchingRegion.governorate} هو ${matchingRegion.minOrderAmount} جنيه`
      });
    }

    if (settings.minimumOrderAmount && calculatedSubtotal < settings.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        error: `الحد الأدنى للطلب من المتجر هو ${settings.minimumOrderAmount} جنيه`
      });
    }

    // 6. READ-ONLY COUPON VALIDATION
    // Strictly NO mutation of coupon usage before durable persistence success
    let discountAmount = 0;
    let validatedCouponCode: string | undefined = undefined;

    if (safeCouponCode) {
      const coupon = coupons.find(c => c.code.trim().toUpperCase() === safeCouponCode.toUpperCase() && c.isActive);
      if (coupon) {
        const isEligible = !coupon.minOrderAmount || calculatedSubtotal >= coupon.minOrderAmount;
        const withinLimit = !coupon.usageLimit || coupon.usageCount < coupon.usageLimit;
        if (isEligible && withinLimit) {
          if (coupon.discountType === 'percentage') {
            let d = (calculatedSubtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount && d > coupon.maxDiscount) d = coupon.maxDiscount;
            discountAmount = Math.round(d * 10) / 10;
          } else {
            discountAmount = Math.min(coupon.discountValue, calculatedSubtotal);
          }
          validatedCouponCode = coupon.code;
        }
      }
    }

    // 7. FINAL TOTAL & UNTRUSTED DEPOSIT HARDENING
    const finalTotal = Math.max(0, calculatedSubtotal + deliveryFee - discountAmount);

    let depositRequired = 0;
    if (paymentMethod === 'cash_on_delivery') {
      depositRequired = 0;
    } else if (settings.defaultDepositType === 'percentage') {
      depositRequired = Math.round((finalTotal * (settings.defaultDepositValue || 20)) / 100);
    } else if (settings.defaultDepositType === 'fixed') {
      depositRequired = Math.min(settings.defaultDepositValue || 50, finalTotal);
    }

    // CRITICAL: Treat depositPaid from client as UNTRUSTED and ignore it completely.
    // Client cannot declare money as paid. Initial customer order is always depositPaid = 0.
    const initialDepositPaid = 0;
    const initialDepositStatus = (paymentMethod === 'cash_on_delivery' || depositRequired === 0) ? 'none' : 'pending';
    const remainingAmount = finalTotal;

    // 8. GENERATE USER-FRIENDLY, COLLISION-RESISTANT ORDER NUMBER
    const supabaseAdmin = getServerSupabase();
    const orderNumber = await generateUniqueOrderNumber(supabaseAdmin);
    const orderId = `ord-${Date.now()}-${crypto.randomInt(100, 999)}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customerId,
      customerName: customerName.trim(),
      customerPhone: verifiedPhone,
      governorate: governorate.trim(),
      city: typeof city === 'string' ? city.trim() : '',
      district: typeof district === 'string' ? district.trim() : '',
      address: address.trim(),
      notes: safeNotes,
      items: verifiedOrderItems,
      subtotal: calculatedSubtotal,
      deliveryFee,
      discountAmount,
      couponCode: validatedCouponCode,
      total: finalTotal,
      paymentMethod,
      depositRequired,
      depositPaid: initialDepositPaid,
      depositStatus: initialDepositStatus,
      depositTransactionRef: safeTransactionRef,
      remainingAmount,
      status: 'new',
      createdAt: new Date().toISOString(),
      deliveryTargetDate: 'نفس اليوم مبرد 🚚',
      isBeforeCutoff: true,
      estimatedDeliveryTime: 'خلال اليوم صيد مبرد'
    };

    // 9. SAFE DURABLE PERSISTENCE
    // If Supabase is configured, persistence MUST succeed before returning HTTP 201.
    // If persistence fails, do NOT permanently add order to in-memory orders, return HTTP 500/503.
    // If Supabase is NOT configured, clearly fail unless ALLOW_IN_MEMORY_ORDERS=true.
    if (supabaseAdmin) {
      try {
        const { error: insertError } = await supabaseAdmin.from('orders').insert({
          customer_name: newOrder.customerName,
          phone: newOrder.customerPhone,
          address: `${newOrder.governorate} - ${newOrder.city} - ${newOrder.address}`,
          notes: newOrder.notes || '',
          items: newOrder.items,
          total_amount: newOrder.total,
          deposit_amount: 0,
          payment_method: newOrder.paymentMethod,
          status: 'pending'
        });

        if (insertError) {
          console.error('[Order Persistence] Failed to persist order in Supabase');
          return res.status(500).json({
            success: false,
            error: 'تعذر حفظ الطلب في قاعدة البيانات بشكل دائم. يرجى المحاولة لاحقاً أو التواصل هاتفياً مع المتجر.'
          });
        }
      } catch (dbErr) {
        console.error('[Order Persistence] Exception during durable database insert');
        return res.status(500).json({
          success: false,
          error: 'حدث خطأ أثناء معالجة وحفظ الطلب. يرجى إعادة المحاولة.'
        });
      }
    } else {
      const allowInMemory = process.env.ALLOW_IN_MEMORY_ORDERS === 'true';
      if (!allowInMemory) {
        return res.status(503).json({
          success: false,
          error: 'خدمة تسجيل الطلبات الدائمة غير مهيأة حالياً في الخادم. يرجى التواصل مع المتجر مباشرة لتأكيد طلبك.'
        });
      }
    }

    // Success: add to memory store for active runtime tracking
    orders.unshift(newOrder);

    res.status(201).json({
      success: true,
      message: 'تم استلام وتأكيد طلبك بنجاح وسيبدأ تجهيزه طازجاً فوراً',
      data: newOrder
    });
  });

  // ==========================================
  // COUPONS API (Validation only for customer)
  // ==========================================

  app.post('/api/coupons/validate', (req, res) => {
    const { code, cartTotal } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'يرجى إدخال كود الكوبون' });
    }

    const coupon = coupons.find(c => c.code.trim().toUpperCase() === code.trim().toUpperCase());
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'كود الكوبون غير صحيح أو غير موجود' });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ success: false, error: 'هذا الكوبون غير مفعّل حالياً' });
    }

    const rawTotal = Number(cartTotal);
    const total = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;

    if (coupon.minOrderAmount && total < coupon.minOrderAmount) {
      return res.status(400).json({ 
        success: false, 
        error: `الحد الأدنى لتطبيق هذا الكوبون هو ${coupon.minOrderAmount} جنيه` 
      });
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, error: 'تم استهلاك الحد الأقصى لاستخدام هذا الكوبون' });
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (total * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = Math.min(coupon.discountValue, total);
    }

    res.json({
      success: true,
      message: `تم تطبيق كود الخصم بنجاح: خصم ${discount} جنيه`,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Math.round(discount * 10) / 10
      }
    });
  });

  // ==========================================
  // REGIONS & SETTINGS (Public Customer info)
  // ==========================================

  app.get('/api/regions', (req, res) => {
    const active = regions.filter(r => r.isActive);
    res.json({ success: true, count: active.length, data: active });
  });

  app.get('/api/settings', (req, res) => {
    const safeSettings: StoreSettings = {
      cutoffHour: settings.cutoffHour,
      cutoffMinute: settings.cutoffMinute,
      isStoreOpen: settings.isStoreOpen,
      minimumOrderAmount: settings.minimumOrderAmount,
      whatsappNumber: settings.whatsappNumber,
      instapayNumber: settings.instapayNumber,
      vodafoneCashNumber: settings.vodafoneCashNumber,
      defaultDepositType: settings.defaultDepositType,
      defaultDepositValue: settings.defaultDepositValue,
      allowCoupons: settings.allowCoupons
    };
    res.json({ success: true, data: safeSettings });
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
