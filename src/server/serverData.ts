import { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from './supabaseAdmin';
import { 
  Product, 
  ProductVariant, 
  Coupon, 
  DeliveryRegion, 
  StoreSettings 
} from '../types';
import { 
  INITIAL_REGIONS, 
  INITIAL_SETTINGS, 
  INITIAL_COUPONS 
} from '../data/initialData';

/**
 * SERVER-SIDE Supabase Data Fetchers
 * Strictly uses getServerSupabase() with SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY.
 * Never depends on browser VITE_* variables.
 * Never imported into client bundle.
 */

export async function fetchServerProducts(client: SupabaseClient | null): Promise<Product[]> {
  if (!client) return [];

  try {
    let prodRows: any[] | null = null;
    const { data: orderedData, error: prodError } = await client
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true });

    if (prodError) {
      if (prodError.code === 'PGRST205') {
        return [];
      }
      const { data: fallbackData, error: fallbackError } = await client
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

    // Fetch product variants
    let variantsMap: Record<string, ProductVariant[]> = {};
    try {
      const { data: variantRows, error: varError } = await client
        .from('product_variants')
        .select('*')
        .order('sort_order', { ascending: true });

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
      // Ignore if table not present
    }

    return prodRows.map((row) => ({
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
  } catch (err) {
    console.error('[Server Data] Error fetching products from Supabase:', err);
    return [];
  }
}

export async function fetchServerCoupons(client: SupabaseClient | null): Promise<Coupon[]> {
  if (!client) return INITIAL_COUPONS;

  try {
    const { data, error } = await client
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

export async function fetchServerDeliveryRegions(client: SupabaseClient | null): Promise<DeliveryRegion[]> {
  if (!client) return INITIAL_REGIONS;

  try {
    const { data, error } = await client
      .from('delivery_regions')
      .select('*')
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
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

export async function fetchServerStoreSettings(client: SupabaseClient | null): Promise<StoreSettings> {
  if (!client) return INITIAL_SETTINGS;

  try {
    const { data, error } = await client
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
 * Synchronize all server-side data models using the admin Supabase client
 */
export async function syncAllServerData() {
  const client = getServerSupabase();
  const [prods, coup, reg, sett] = await Promise.all([
    fetchServerProducts(client),
    fetchServerCoupons(client),
    fetchServerDeliveryRegions(client),
    fetchServerStoreSettings(client)
  ]);

  return {
    products: prods,
    coupons: coup.length > 0 ? coup : INITIAL_COUPONS,
    regions: reg.length > 0 ? reg : INITIAL_REGIONS,
    settings: sett || INITIAL_SETTINGS
  };
}
