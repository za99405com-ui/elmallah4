import { 
  Product, 
  ProductVariant,
  StoreCategory, 
  Order, 
  StoreSettings, 
  Coupon, 
  DeliveryRegion 
} from '../types';
import { getSupabase } from '../utils/supabase';

// ==============================================================================
// 1. Clean Category Definitions (Structure without mock records)
// ==============================================================================
export const STORE_CATEGORIES: StoreCategory[] = [
  {
    id: 'fresh_sea',
    name: 'أسماك بحرية فاخرة',
    emoji: '🌊',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
    countBadge: 'صيد بحري'
  },
  {
    id: 'fresh_lake',
    name: 'بلطي وبوري طازة',
    emoji: '🐟',
    image: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=600&q=80',
    countBadge: 'طازج يومياً'
  },
  {
    id: 'shrimp_seafood',
    name: 'جمبري وبحريات',
    emoji: '🦐',
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80',
    countBadge: 'سويسي بلدي'
  },
  {
    id: 'fillet',
    name: 'فيليه طازج',
    emoji: '🐠',
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
    countBadge: 'صافي بدون حسك'
  },
  {
    id: 'offers',
    name: 'باقات وعروض طازة',
    emoji: '⭐',
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80',
    countBadge: 'توفير خاص'
  }
];

// ==============================================================================
// 2. Clean Default State (No fake products, verified Egyptian delivery regions)
// ==============================================================================
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_COUPONS: Coupon[] = [];
export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_REGIONS: DeliveryRegion[] = [
  {
    id: 'cairo',
    governorate: 'القاهرة',
    cities: [
      'مدينة نصر',
      'مصر الجديدة',
      'المعادي',
      'التجمع الخامس',
      'التجمع الأول',
      'الرحاب',
      'مدينتي',
      'الشروق',
      'الزمالك',
      'شبرا',
      'المقطم',
      'عين شمس'
    ],
    deliveryFee: 40,
    minOrderAmount: 200,
    estimatedTime: 'نفس اليوم مبرد 🚚',
    isActive: true
  },
  {
    id: 'giza',
    governorate: 'الجيزة',
    cities: [
      'الدقي',
      'المهندسين',
      'العجوزة',
      'فيصل',
      'الهرم',
      '6 أكتوبر',
      'الشيخ زايد',
      'حدائق الأهرام',
      'العمرانية'
    ],
    deliveryFee: 45,
    minOrderAmount: 200,
    estimatedTime: 'نفس اليوم مبرد 🚚',
    isActive: true
  },
  {
    id: 'alexandria',
    governorate: 'الإسكندرية',
    cities: [
      'سموحة',
      'سيدي جابر',
      'ستانلي',
      'لوران',
      'ميامي',
      'المنتزه',
      'العجمي'
    ],
    deliveryFee: 60,
    minOrderAmount: 300,
    estimatedTime: 'شحن سريع مبرد 🚚',
    isActive: true
  }
];

export const INITIAL_SETTINGS: StoreSettings = {
  cutoffHour: 3,         // 3:00 AM Daily Cutoff
  cutoffMinute: 0,
  isStoreOpen: true,
  minimumOrderAmount: 0,
  whatsappNumber: '01015192040',
  instapayNumber: '01015192040',
  vodafoneCashNumber: '01015192040',
  defaultDepositType: 'percentage',
  defaultDepositValue: 20, // 20% deposit
  allowCoupons: true
};

// ==============================================================================
// 3. Supabase Direct Data Fetching Functions
// ==============================================================================

/**
 * جلب قائمة المنتجات وخيارات البيع (Product Variants) مباشرة من جداول Supabase
 */
export async function fetchProductsFromSupabase(client?: any): Promise<Product[]> {
  const supabase = client || getSupabase();
  if (!supabase) {
    return [];
  }

  try {
    // 1. جلب المنتجات مرتبة حسب id مع معالجة عدم وجود جدول أو أعمدة ترتيب
    let prodRows: any[] | null = null;
    const { data: orderedData, error: prodError } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    if (prodError) {
      if (prodError.code === 'PGRST205') {
        // Table doesn't exist yet in Supabase
        return [];
      }
      // Try simple query without order
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('products')
        .select('*');

      if (fallbackError) {
        return [];
      }
      prodRows = fallbackData;
    } else {
      prodRows = orderedData;
    }

    if (!prodRows || prodRows.length === 0) {
      return [];
    }

    // 2. جلب خيارات البيع والأحجام المقترنة (Product Variants) إن وجدت
    let variantsMap: Record<string, ProductVariant[]> = {};
    try {
      const { data: variantRows, error: varError } = await supabase
        .from('product_variants')
        .select('*');

      if (!varError && variantRows) {
        for (const row of variantRows) {
          const prodId = String(row.product_id);
          if (!variantsMap[prodId]) {
            variantsMap[prodId] = [];
          }
          variantsMap[prodId].push({
            id: String(row.id),
            productId: String(row.product_id),
            label: row.label,
            weightKg: Number(row.weight_kg ?? 1),
            pieceCount: Number(row.piece_count ?? 1),
            pieceWeightMin: row.piece_weight_min ? Number(row.piece_weight_min) : undefined,
            pieceWeightMax: row.piece_weight_max ? Number(row.piece_weight_max) : undefined,
            price: Number(row.price),
            originalPrice: row.original_price ? Number(row.original_price) : undefined,
            stockQuantity: Number(row.stock_quantity ?? 50),
            isActive: row.is_active !== false,
            sortOrder: Number(row.sort_order ?? 0)
          });
        }
      }
    } catch {
      // Optional table, ignore if not created
    }

    // 3. تحويل أعمدة قاعدة البيانات إلى نموذج المنتج (Product) في التطبيق
    const products: Product[] = prodRows.map((row) => ({
      id: String(row.id),
      name: row.name,
      category: row.category,
      price: Number(row.price),
      originalPrice: row.original_price ? Number(row.original_price) : undefined,
      unit: row.unit || 'كيلو',
      inStock: Boolean(row.in_stock !== false),
      isVisible: row.is_visible !== false,
      sortOrder: Number(row.sort_order ?? 0),
      image: row.image || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
      description: row.description || '',
      saleType: row.sale_type || 'weight',
      piecesPerKiloRange: row.pieces_per_kilo_range || undefined,
      pieceWeightRange: row.piece_weight_range || undefined,
      minOrder: row.min_order ? Number(row.min_order) : 1,
      maxOrder: row.max_order ? Number(row.max_order) : undefined,
      depositType: row.deposit_type || 'percentage',
      depositValue: row.deposit_value ? Number(row.deposit_value) : 20,
      isPopular: Boolean(row.is_popular),
      isTodayOffer: Boolean(row.is_today_offer),
      isNewArrival: Boolean(row.is_new_arrival),
      salesCount: Number(row.sales_count ?? 0),
      badgeText: row.badge_text || undefined,
      variants: variantsMap[String(row.id)] || []
    }));

    return products;
  } catch (error) {
    return [];
  }
}

/**
 * جلب تفاصيل منتج واحد مع خياراته مباشرة من Supabase
 */
export async function fetchProductByIdFromSupabase(productId: string): Promise<Product | null> {
  const supabase = getSupabase();
  if (!supabase || !productId) return null;

  try {
    const { data: row, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !row) return null;

    // Fetch variants
    let variants: ProductVariant[] = [];
    try {
      const { data: varRows, error: varError } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId);

      if (!varError && varRows) {
        variants = varRows.map((v) => ({
          id: String(v.id),
          productId: String(v.product_id),
          label: v.label,
          weightKg: Number(v.weight_kg ?? 1),
          pieceCount: Number(v.piece_count ?? 1),
          pieceWeightMin: v.piece_weight_min ? Number(v.piece_weight_min) : undefined,
          pieceWeightMax: v.piece_weight_max ? Number(v.piece_weight_max) : undefined,
          price: Number(v.price),
          originalPrice: v.original_price ? Number(v.original_price) : undefined,
          stockQuantity: Number(v.stock_quantity ?? 50),
          isActive: v.is_active !== false,
          sortOrder: Number(v.sort_order ?? 0)
        }));
      }
    } catch {
      // ignore variant table errors
    }

    return {
      id: String(row.id),
      name: row.name,
      category: row.category,
      price: Number(row.price),
      originalPrice: row.original_price ? Number(row.original_price) : undefined,
      unit: row.unit || 'كيلو',
      inStock: Boolean(row.in_stock !== false),
      isVisible: row.is_visible !== false,
      sortOrder: Number(row.sort_order ?? 0),
      image: row.image || 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
      description: row.description || '',
      saleType: row.sale_type || 'weight',
      piecesPerKiloRange: row.pieces_per_kilo_range || undefined,
      pieceWeightRange: row.piece_weight_range || undefined,
      minOrder: row.min_order ? Number(row.min_order) : 1,
      maxOrder: row.max_order ? Number(row.max_order) : undefined,
      depositType: row.deposit_type || 'percentage',
      depositValue: row.deposit_value ? Number(row.deposit_value) : 20,
      isPopular: Boolean(row.is_popular),
      isTodayOffer: Boolean(row.is_today_offer),
      isNewArrival: Boolean(row.is_new_arrival),
      salesCount: Number(row.sales_count ?? 0),
      badgeText: row.badge_text || undefined,
      variants
    };
  } catch {
    return null;
  }
}

/**
 * جلب مناطق التوصيل المعتمدة مباشرة من Supabase (مع الاحتفاظ بالمناطق الافتراضية)
 */
export async function fetchDeliveryRegionsFromSupabase(client?: any): Promise<DeliveryRegion[]> {
  const supabase = client || getSupabase();
  if (!supabase) return INITIAL_REGIONS;

  try {
    const { data, error } = await supabase
      .from('delivery_regions')
      .select('*')
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      // Table does not exist in schema cache or is empty -> use standard delivery regions
      return INITIAL_REGIONS;
    }

    return data.map((row) => ({
      id: String(row.id),
      governorate: row.governorate,
      cities: Array.isArray(row.cities) ? row.cities : [],
      deliveryFee: Number(row.delivery_fee || 0),
      minOrderAmount: Number(row.min_order_amount || 0),
      estimatedTime: row.estimated_time || 'نفس اليوم مبرد 🚚',
      isActive: row.is_active !== false
    }));
  } catch {
    return INITIAL_REGIONS;
  }
}

/**
 * جلب إعدادات المتجر ومواعيد الإغلاق مباشرة من Supabase
 */
export async function fetchStoreSettingsFromSupabase(client?: any): Promise<StoreSettings | null> {
  const supabase = client || getSupabase();
  if (!supabase) return INITIAL_SETTINGS;

  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return INITIAL_SETTINGS;
    }

    return {
      cutoffHour: Number(data.cutoff_hour ?? 3),
      cutoffMinute: Number(data.cutoff_minute ?? 0),
      isStoreOpen: data.is_store_open !== false,
      minimumOrderAmount: Number(data.minimum_order_amount ?? 0),
      whatsappNumber: data.whatsapp_number || '01015192040',
      instapayNumber: data.instapay_number || '01015192040',
      vodafoneCashNumber: data.vodafone_cash_number || '01015192040',
      defaultDepositType: data.default_deposit_type || 'percentage',
      defaultDepositValue: Number(data.default_deposit_value ?? 20),
      allowCoupons: data.allow_coupons !== false
    };
  } catch {
    return INITIAL_SETTINGS;
  }
}

/**
 * جلب كوبونات الخصم الفعالة مباشرة من Supabase
 */
export async function fetchCouponsFromSupabase(client?: any): Promise<Coupon[]> {
  const supabase = client || getSupabase();
  if (!supabase) return INITIAL_COUPONS;

  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      return INITIAL_COUPONS;
    }

    return data.map((row) => ({
      id: String(row.id),
      code: row.code,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      minOrderAmount: row.min_order_amount ? Number(row.min_order_amount) : undefined,
      maxDiscount: row.max_discount ? Number(row.max_discount) : undefined,
      usageLimit: row.usage_limit ? Number(row.usage_limit) : undefined,
      usageCount: Number(row.usage_count || 0),
      expiryDate: row.expiry_date || undefined,
      isActive: row.is_active !== false
    }));
  } catch {
    return INITIAL_COUPONS;
  }
}

/**
 * جلب طلبات عميل محدد مباشرة من Supabase مع عناصر الطلب
 */
export async function fetchCustomerOrdersFromSupabase(params: { 
  customerId?: string; 
  phone?: string; 
}): Promise<Order[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  if (!params.customerId && !params.phone) return [];

  try {
    let query = supabase.from('orders').select('*');

    if (params.phone) {
      query = query.eq('phone', params.phone);
    } else if (params.customerId) {
      query = query.eq('customer_id', params.customerId);
    }

    const { data: orderRows, error: ordErr } = await query.order('created_at', { ascending: false });

    if (ordErr || !orderRows || orderRows.length === 0) {
      return [];
    }

    return orderRows.map((o) => {
      let orderItems: any[] = [];
      if (Array.isArray(o.items)) {
        orderItems = o.items;
      } else if (typeof o.items === 'string') {
        try {
          orderItems = JSON.parse(o.items);
        } catch {
          orderItems = [];
        }
      }

      return {
        id: String(o.id),
        orderNumber: o.order_number || `ORD-${String(o.id).padStart(5, '0')}`,
        customerId: o.customer_id || '',
        customerName: o.customer_name || '',
        customerPhone: o.phone || o.customer_phone || '',
        governorate: o.governorate || 'القاهرة',
        city: o.city || '',
        district: o.district || '',
        address: o.address || '',
        notes: o.notes || '',
        items: orderItems,
        subtotal: Number(o.subtotal || o.total_amount || 0),
        deliveryFee: Number(o.delivery_fee || 0),
        discountAmount: Number(o.discount_amount || 0),
        couponCode: o.coupon_code || undefined,
        total: Number(o.total || o.total_amount || 0),
        paymentMethod: o.payment_method || 'cash',
        depositRequired: Number(o.deposit_required || o.deposit_amount || 0),
        depositPaid: Number(o.deposit_paid || 0),
        depositStatus: o.deposit_status || 'none',
        depositTransactionRef: o.deposit_transaction_ref || undefined,
        remainingAmount: Number(o.remaining_amount || 0),
        status: o.status || 'pending',
        createdAt: o.created_at || new Date().toISOString(),
        deliveryTargetDate: 'نفس اليوم مبرد 🚚',
        isBeforeCutoff: true
      };
    });
  } catch {
    return [];
  }
}

/**
 * دالة شاملة لجلب جميع بيانات المتجر الأساسية من Supabase دفعة واحدة عند بدء تشغيل التطبيق
 */
export async function fetchAllInitialDataFromSupabase(): Promise<{
  products: Product[];
  categories: StoreCategory[];
  regions: DeliveryRegion[];
  coupons: Coupon[];
  settings: StoreSettings | null;
}> {
  const [productsRes, regionsRes, couponsRes, settingsRes] = await Promise.allSettled([
    fetchProductsFromSupabase(),
    fetchDeliveryRegionsFromSupabase(),
    fetchCouponsFromSupabase(),
    fetchStoreSettingsFromSupabase()
  ]);

  return {
    products: productsRes.status === 'fulfilled' ? productsRes.value : [],
    categories: STORE_CATEGORIES,
    regions: regionsRes.status === 'fulfilled' ? regionsRes.value : [],
    coupons: couponsRes.status === 'fulfilled' ? couponsRes.value : [],
    settings: settingsRes.status === 'fulfilled' ? settingsRes.value : null
  };
}
