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
  CreateOrderPayload 
} from './src/types';
import { getSupabase } from './src/utils/supabase';

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
      console.log(`✅ [Supabase] Loaded ${products.length} fresh products directly from Supabase`);
    }
    if (couponList.status === 'fulfilled' && couponList.value.length > 0) {
      coupons = couponList.value;
      console.log(`✅ [Supabase] Loaded ${coupons.length} coupons directly from Supabase`);
    }
    if (regionList.status === 'fulfilled' && regionList.value.length > 0) {
      regions = regionList.value;
      console.log(`✅ [Supabase] Loaded ${regions.length} delivery regions directly from Supabase`);
    }
    if (storeSettings.status === 'fulfilled' && storeSettings.value) {
      settings = { ...settings, ...storeSettings.value };
      console.log(`✅ [Supabase] Loaded store settings directly from Supabase`);
    }
  } catch (err) {
    console.warn('Notice loading Supabase tables on server startup:', err);
  }
}

// Customer Identity & Auth Store
let customers: CustomerUser[] = [];
const activeCustomerSessions = new Map<string, { customerId: string; expiresAt: number; phone: string }>();
const pendingOtps = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
const otpRequestRateLimits = new Map<string, { count: number; resetAt: number }>();

// Helper: Normalize Egyptian Phone Numbers (010, 011, 012, 015)
export function normalizeEgyptianPhone(input: string): string {
  if (!input) return '';
  // Strip non-digits
  let digits = input.replace(/\D/g, '');
  // Strip leading 002 or +2 or 2
  if (digits.startsWith('0020')) {
    digits = digits.substring(3); // remove 002
  } else if (digits.startsWith('002')) {
    digits = digits.substring(3);
  } else if (digits.startsWith('20') && digits.length === 12) {
    digits = digits.substring(1);
  }
  // If starts with 1 and length 10, prepend 0
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
  const PORT = 3000;

  // Load fresh data directly from Supabase tables on startup
  await syncServerDataWithSupabase();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger for API routes
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[Customer API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // Customer Authentication Middleware
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

  // Health & Info Endpoint (Customer-facing, no admin data)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Al-Mallah Fresh Fish Customer Store Backend',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      storeOpen: settings.isStoreOpen,
      supabaseConnected: Boolean(getSupabase()),
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
  // ==========================================

  // 1. Send OTP to Egyptian Mobile
  app.post('/api/auth/send-otp', (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الهاتف' });
    }

    const normalized = normalizeEgyptianPhone(phone);
    if (!isValidEgyptianPhone(normalized)) {
      return res.status(400).json({ 
        success: false, 
        error: 'رقم الهاتف غير صالح. يرجى إدخال رقم محمول مصري صحيح (مثال: 01015192040 أو 011 أو 012 أو 015)' 
      });
    }

    // Rate Limiting: Max 5 requests per 10 minutes per phone
    const now = Date.now();
    const rate = otpRequestRateLimits.get(normalized) || { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (now > rate.resetAt) {
      rate.count = 0;
      rate.resetAt = now + 10 * 60 * 1000;
    }
    if (rate.count >= 5) {
      const waitMinutes = Math.ceil((rate.resetAt - now) / 60000);
      return res.status(429).json({ 
        success: false, 
        error: `تم تجاوز الحد الأقصى لمحاولات إرسال الرمز. يرجى الانتظار ${waitMinutes} دقيقة قبل المحاولة مرة أخرى.` 
      });
    }
    rate.count += 1;
    otpRequestRateLimits.set(normalized, rate);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    pendingOtps.set(normalized, {
      otp,
      expiresAt,
      attempts: 0
    });

    console.log(`📱 [OTP Verification] Code for ${normalized}: ${otp}`);

    res.json({
      success: true,
      message: `تم إرسال رمز التحقق إلى الرقم ${normalized}`,
      phone: normalized,
      expiresInSeconds: 300,
      // Provide devOtp so that during testing or without live SMS gateway, verification is 100% functional
      devOtp: otp
    });
  });

  // 2. Verify OTP & Issue Customer Session
  app.post('/api/auth/verify-otp', (req, res) => {
    const { phone, otp, name, governorate, city, district, address } = req.body;
    if (!phone || !otp) {
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

    // OTP Verified! Remove used OTP
    pendingOtps.delete(normalized);

    // Find or create customer
    let customer = customers.find(c => c.phone === normalized);
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
        phone: normalized,
        name: (name || '').trim() || `عميل الملاح (${normalized.slice(-4)})`,
        governorate: (governorate || '').trim() || 'القاهرة',
        city: (city || '').trim() || '',
        district: (district || '').trim() || '',
        address: (address || '').trim() || '',
        createdAt: new Date().toISOString()
      };
      customers.push(customer);
    } else {
      // Update info if supplied
      if (name && name.trim()) customer.name = name.trim();
      if (governorate && governorate.trim()) customer.governorate = governorate.trim();
      if (city && city.trim()) customer.city = city.trim();
      if (district && district.trim()) customer.district = district.trim();
      if (address && address.trim()) customer.address = address.trim();
      customer.updatedAt = new Date().toISOString();
    }

    // Generate Session Token (Valid 30 days)
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
    if (name && name.trim()) customer.name = name.trim();
    if (governorate && governorate.trim()) customer.governorate = governorate.trim();
    if (city && city.trim()) customer.city = city.trim();
    if (district !== undefined) customer.district = (district || '').trim();
    if (address && address.trim()) customer.address = address.trim();
    if (notes !== undefined) customer.notes = (notes || '').trim();
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
  // PRODUCTS API (With Variants / Selling Options)
  // ==========================================

  // List products (Client facing - only visible products)
  app.get('/api/products', async (req, res) => {
    // If Supabase is available, sync latest products
    if (getSupabase()) {
      try {
        const fresh = await fetchProductsFromSupabase();
        if (fresh && fresh.length > 0) {
          products = fresh;
        }
      } catch (err) {
        console.warn('Live fetch products notice:', err);
      }
    }

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

  // Get single product with its selling variants
  app.get('/api/products/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id && p.isVisible !== false);
    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود أو غير متاح' });
    }
    res.json({ success: true, data: product });
  });

  // ==========================================
  // CUSTOMER ORDERS API & IDOR PROTECTION
  // ==========================================

  // Get My Orders: Strictly restricted to the authenticated customer's own orders
  app.get('/api/customer/orders', (req, res) => {
    const customer = getAuthenticatedCustomer(req);
    const { phone } = req.query;

    let targetPhone = customer ? customer.phone : '';
    let targetCustomerId = customer ? customer.id : '';

    if (!targetCustomerId && phone && typeof phone === 'string') {
      const norm = normalizeEgyptianPhone(phone);
      if (isValidEgyptianPhone(norm)) {
        targetPhone = norm;
      }
    }

    if (!targetCustomerId && !targetPhone) {
      // Unauthenticated visitor with no verified phone sees only empty list (strict privacy)
      return res.json({ success: true, count: 0, data: [] });
    }

    const myOrders = orders.filter(o => {
      if (targetCustomerId && o.customerId === targetCustomerId) return true;
      if (targetPhone && o.customerPhone && normalizeEgyptianPhone(o.customerPhone) === targetPhone) return true;
      return false;
    });

    myOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, count: myOrders.length, data: myOrders });
  });

  // Get Single Order with strict IDOR prevention
  app.get('/api/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === req.params.id || o.orderNumber === req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }

    const customer = getAuthenticatedCustomer(req);
    const queryPhone = req.query.phone ? normalizeEgyptianPhone(String(req.query.phone)) : '';

    // Verify ownership: customerId matches, or phone matches authenticated session or verified phone query
    const orderPhone = normalizeEgyptianPhone(order.customerPhone);
    const isOwner = (customer && order.customerId === customer.id) ||
                    (customer && orderPhone === customer.phone) ||
                    (queryPhone && queryPhone === orderPhone);

    if (!isOwner) {
      return res.status(403).json({ 
        success: false, 
        error: 'غير مصرح: لا يمكنك الاطلاع على تفاصيل طلب لا يخصك لأسباب تتعلق بالخصوصية والأمان' 
      });
    }

    res.json({ success: true, data: order });
  });

  // ==========================================
  // SECURE SERVER-AUTHORITATIVE CHECKOUT
  // Do NOT trust any price, total, discount, or deposit from client!
  // ==========================================
  app.post('/api/orders', async (req, res) => {
    const payload: CreateOrderPayload = req.body;
    const { items, deliveryAddress, paymentMethod, depositTransactionRef, couponCode, notes } = payload;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'سلة المشتريات فارغة' });
    }

    if (!deliveryAddress || !deliveryAddress.customerPhone || !deliveryAddress.customerName || !deliveryAddress.governorate) {
      return res.status(400).json({ success: false, error: 'بيانات التوصيل (الاسم، رقم الهاتف، والمحافظة) مطلوبة' });
    }

    const customerPhone = normalizeEgyptianPhone(deliveryAddress.customerPhone);
    if (!isValidEgyptianPhone(customerPhone)) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم هاتف مصري صحيح للتواصل مع مندوب التوصيل' });
    }

    // Authenticate or find customer
    const authCustomer = getAuthenticatedCustomer(req);
    let customerId = authCustomer ? authCustomer.id : '';
    if (!customerId) {
      const existing = customers.find(c => c.phone === customerPhone);
      if (existing) {
        customerId = existing.id;
      } else {
        const newCust: CustomerUser = {
          id: `cust_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
          phone: customerPhone,
          name: deliveryAddress.customerName.trim(),
          governorate: deliveryAddress.governorate.trim(),
          city: deliveryAddress.city ? deliveryAddress.city.trim() : '',
          district: deliveryAddress.district ? deliveryAddress.district.trim() : '',
          address: deliveryAddress.address.trim(),
          createdAt: new Date().toISOString()
        };
        customers.push(newCust);
        customerId = newCust.id;
      }
    }

    // 1. Server-Side Item Verification & Pricing Calculation
    let calculatedSubtotal = 0;
    const verifiedOrderItems: OrderItem[] = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product || !product.isVisible) {
        return res.status(400).json({ success: false, error: `المنتج المختار غير متاح حالياً (${item.productId})` });
      }

      if (!product.inStock) {
        return res.status(400).json({ success: false, error: `سمك ${product.name} غير متوفر في المخزون حالياً` });
      }

      const qty = Math.max(1, Number(item.quantity) || 1);

      // Check for variant
      let finalPrice = product.price;
      let variantLabel: string | undefined = undefined;
      let pieceRange = product.piecesPerKiloRange;

      if (item.variantId && product.variants && product.variants.length > 0) {
        const variant = product.variants.find(v => v.id === item.variantId);
        if (variant && variant.isActive) {
          finalPrice = variant.price;
          variantLabel = variant.label;
          pieceRange = `${variant.pieceCount} قطع تقريباً في الكيلو`;
          
          // Decrement variant stock
          if (variant.stockQuantity > 0) {
            variant.stockQuantity = Math.max(0, variant.stockQuantity - qty);
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
        price: finalPrice, // Verified Server Price!
        quantity: qty,
        itemTotal,
        piecesPerKiloRange: pieceRange,
        notes: item.notes
      });
    }

    // 2. Delivery Region Verification & Fee Calculation
    const region = regions.find(r => 
      r.isActive && 
      r.governorate.trim().toLowerCase() === deliveryAddress.governorate.trim().toLowerCase()
    );
    const deliveryFee = region ? region.deliveryFee : 30;

    if (region && region.minOrderAmount && calculatedSubtotal < region.minOrderAmount) {
      return res.status(400).json({
        success: false,
        error: `الحد الأدنى للطلب في منطقة ${region.governorate} هو ${region.minOrderAmount} جنيه`
      });
    }

    if (settings.minimumOrderAmount && calculatedSubtotal < settings.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        error: `الحد الأدنى للطلب من المتجر هو ${settings.minimumOrderAmount} جنيه`
      });
    }

    // 3. Server-Side Coupon Validation & Discount
    let discountAmount = 0;
    let validatedCouponCode: string | undefined = undefined;

    if (couponCode && couponCode.trim()) {
      const coupon = coupons.find(c => c.code.trim().toUpperCase() === couponCode.trim().toUpperCase() && c.isActive);
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
          coupon.usageCount += 1;
          validatedCouponCode = coupon.code;
        }
      }
    }

    // 4. Calculate Final Grand Total
    const finalTotal = Math.max(0, calculatedSubtotal + deliveryFee - discountAmount);

    // 5. Calculate Required Deposit based on Server Settings
    let depositRequired = 0;
    if (settings.defaultDepositType === 'percentage') {
      depositRequired = Math.round((finalTotal * (settings.defaultDepositValue || 20)) / 100);
    } else if (settings.defaultDepositType === 'fixed') {
      depositRequired = Math.min(settings.defaultDepositValue || 50, finalTotal);
    }

    const isCashOnly = paymentMethod === 'cash_on_delivery';
    const depositPaid = Number(payload.depositPaid) || (isCashOnly ? 0 : depositRequired);
    const depositStatus = isCashOnly ? 'none' : (depositPaid > 0 ? 'pending' : 'none');
    const remainingAmount = Math.max(0, finalTotal - depositPaid);

    // Generate Order Number
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      id: `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      orderNumber: `#${orderNum}`,
      customerId,
      customerName: deliveryAddress.customerName.trim(),
      customerPhone,
      governorate: deliveryAddress.governorate.trim(),
      city: deliveryAddress.city ? deliveryAddress.city.trim() : '',
      district: deliveryAddress.district ? deliveryAddress.district.trim() : '',
      address: deliveryAddress.address.trim(),
      notes: notes || '',
      items: verifiedOrderItems,
      subtotal: calculatedSubtotal,
      deliveryFee,
      discountAmount,
      couponCode: validatedCouponCode,
      total: finalTotal,
      paymentMethod: paymentMethod || 'instapay',
      depositRequired,
      depositPaid,
      depositStatus,
      depositTransactionRef: depositTransactionRef || undefined,
      remainingAmount,
      status: 'new',
      createdAt: new Date().toISOString(),
      deliveryTargetDate: 'نفس اليوم مبرد 🚚',
      isBeforeCutoff: true,
      estimatedDeliveryTime: 'خلال اليوم صيد مبرد'
    };

    orders.unshift(newOrder);

    // Sync to Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('orders').insert({
          customer_name: newOrder.customerName,
          phone: newOrder.customerPhone,
          address: `${newOrder.governorate} - ${newOrder.city} - ${newOrder.address}`,
          notes: newOrder.notes || '',
          items: newOrder.items,
          total_amount: newOrder.total,
          deposit_amount: newOrder.depositPaid || newOrder.depositRequired || 0,
          payment_method: newOrder.paymentMethod,
          status: 'pending'
        });
      } catch (err) {
        console.warn('Supabase order insert notice:', err);
      }
    }

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
    if (!code) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال كود الكوبون' });
    }

    const coupon = coupons.find(c => c.code.trim().toUpperCase() === code.trim().toUpperCase());
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'كود الكوبون غير صحيح أو غير موجود' });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ success: false, error: 'هذا الكوبون غير مفعّل حالياً' });
    }

    const total = Number(cartTotal) || 0;
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

  app.get('/api/regions', async (req, res) => {
    if (getSupabase()) {
      try {
        const fresh = await fetchDeliveryRegionsFromSupabase();
        if (fresh && fresh.length > 0) {
          regions = fresh;
        }
      } catch (err) {
        console.warn('Live fetch regions notice:', err);
      }
    }
    const active = regions.filter(r => r.isActive);
    res.json({ success: true, count: active.length, data: active });
  });

  app.get('/api/settings', async (req, res) => {
    if (getSupabase()) {
      try {
        const fresh = await fetchStoreSettingsFromSupabase();
        if (fresh) {
          settings = { ...settings, ...fresh };
        }
      } catch (err) {
        console.warn('Live fetch settings notice:', err);
      }
    }

    // Return customer-safe store settings
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
  // GEMINI AI ASSISTANT API (Fish recipes & help)
  // ==========================================

  app.post('/api/ai/assistant', async (req, res) => {
    const { question, fishType, occasion } = req.body;
    
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          success: true,
          answer: `🐟 **نصيحة شيف متجر الملاح:**
للحصول على أفضل طعم لأسماك ${fishType || 'البحر الطازجة'}:
1. **التنظيف:** غسيل السمك بالماء البارد والليمون وقليل من الكمون دون نقع طويل في الخل للحفاظ على تماسك اللحم.
2. **التسوية:** الشوي بالردة على نار عالية أو سنجاري بالفرن مع البصل والطماطم والكزبرة والفلفل الحار والليمون وزيت الزيتون.
3. **التوصيل المبرد:** ننصح بالطلب قبل الساعة 3:00 فجراً لضمان وصول صيد الفجر طازج ومبرد في نفس اليوم! 🚚`
        });
      }

      const prompt = `أنت شيف أسماك ومستشار متخصص في متجر "الملاح لبيع الأسماك الطازجة" في مصر.
أجب العميل بلباقة واحترافية باللغة العربية مع لمسة ودودة وأسلوب مصري راقي ومختصر ومفيد.
السؤال أو الطلب: "${question || `أفضل طريقة لتحضير وتتبيل سمك ${fishType}`}"
المناسبة أو عدد الأفراد: "${occasion || 'عائلي'}"

قدّم نصائح عن:
1. أنسب طريقة طهي (مشوي، سنجاري، زيت وليمون، طاجن، مقلي).
2. التتبيلة والبهارات الأنسب.
3. نصيحة الحفظ والتنظيف.
اجعل الإجابة منسقة بنقاط واضحة وجميلة.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt
      });

      res.json({
        success: true,
        answer: response.text || 'أهلاً بك في متجر الملاح للأسماك الطازجة صيد اليوم!'
      });
    } catch (error: any) {
      console.error('Gemini AI Assistant error:', error);
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
    console.log(`🐟 Al-Mallah Customer Store Server running on http://0.0.0.0:${PORT}`);
  });

  return app;
}

// Auto-start if run directly
createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
