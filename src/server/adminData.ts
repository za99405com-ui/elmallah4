import type {
  Product,
  ProductCategory,
  ProductVariant,
  DeliveryRegion,
  StoreSettings,
} from '../types';
import { adminPublicGet } from './adminApi';

type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  is_active?: number | boolean;
};

type AdminVariant = {
  id: string;
  productId: string;
  title: string;
  weightKg: number;
  pieceCount: number;
  approxPieceWeightG?: number;
  price: number;
  stockQuantity?: number;
  sortOrder?: number;
  isActive: boolean;
};

type AdminProduct = {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  pricingUnit?: string;
  price: number;
  stockQuantity?: number;
  inStock?: boolean;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  sortOrder?: number;
  imageUrl?: string;
  badge?: string;
  isActive: boolean;
  variants?: AdminVariant[];
};

type AdminRegion = {
  id: string;
  name: string;
  city: string;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedHours: number;
  sortOrder: number;
  isActive: boolean;
};

type AdminSettings = {
  whatsapp?: string;
  instapayHandle?: string;
  instapayNumber?: string;
  vodafoneCash?: string;
  isOpen: boolean;
  minOrderAmount: number;
  depositPercentage: number;
  cutoffHour?: number;
};

function mapCategory(slug?: string, name?: string): ProductCategory {
  const value = `${slug || ''} ${name || ''}`.toLowerCase();

  if (
    value.includes('crustacean') ||
    value.includes('shellfish') ||
    value.includes('جمبري') ||
    value.includes('قشريات') ||
    value.includes('مأكولات بحرية')
  ) {
    return 'shrimp_seafood';
  }

  if (
    value.includes('fillet') ||
    value.includes('فيليه') ||
    value.includes('frozen') ||
    value.includes('مجمد')
  ) {
    return 'fillet';
  }

  if (
    value.includes('offer') ||
    value.includes('عرض') ||
    value.includes('عروض') ||
    value.includes('باقة')
  ) {
    return 'offers';
  }

  if (
    value.includes('lake') ||
    value.includes('freshwater') ||
    value.includes('بلطي') ||
    value.includes('بوري') ||
    value.includes('نهري')
  ) {
    return 'fresh_lake';
  }

  return 'fresh_sea';
}

function mapVariant(v: AdminVariant): ProductVariant {
  const approx = Number(v.approxPieceWeightG || 0);

  return {
    id: String(v.id),
    productId: String(v.productId),
    label: v.title || '',
    weightKg: Number(v.weightKg || 1),
    pieceCount: Number(v.pieceCount || 1),
    pieceWeightMin: approx > 0 ? approx : undefined,
    pieceWeightMax: approx > 0 ? approx : undefined,
    price: Number(v.price || 0),
    stockQuantity: Number(v.stockQuantity || 0),
    isActive: Boolean(v.isActive),
    sortOrder: Number(v.sortOrder || 0),
  };
}

function mapProduct(
  p: AdminProduct,
  categoriesById: Map<string, AdminCategory>
): Product {
  const category = categoriesById.get(String(p.categoryId || ''));

  return {
    id: String(p.id),
    name: p.name,
    category: mapCategory(category?.slug, category?.name || p.categoryName),
    price: Number(p.price || 0),
    unit: p.pricingUnit === 'piece' ? 'قطعة' : 'كيلو',
    inStock: Boolean(p.inStock) && Number(p.stockQuantity || 0) > 0,
    isVisible: Boolean(p.isActive),
    sortOrder: Number(p.sortOrder || 0),
    image: p.imageUrl || '',
    description: p.description || '',
    saleType: p.pricingUnit === 'piece' ? 'piece' : 'weight',
    minOrder:
      p.minOrderQuantity != null ? Number(p.minOrderQuantity) : undefined,
    maxOrder:
      p.maxOrderQuantity != null ? Number(p.maxOrderQuantity) : undefined,
    variants: (p.variants || []).map(mapVariant),
    salesCount: 0,
    badgeText: p.badge || undefined,
  };
}

function mapRegion(r: AdminRegion): DeliveryRegion {
  return {
    id: String(r.id),
    governorate: r.city || '',
    cities: r.name ? [r.name] : [],
    deliveryFee: Number(r.deliveryFee || 0),
    minOrderAmount: Number(r.minOrderAmount || 0),
    estimatedTime:
      Number(r.estimatedHours || 0) > 0
        ? `حوالي ${Number(r.estimatedHours)} ساعة`
        : undefined,
    isActive: Boolean(r.isActive),
  };
}

function mapSettings(s: AdminSettings): StoreSettings {
  const depositPercentage = Number(s.depositPercentage || 0);

  return {
    cutoffHour: Number(s.cutoffHour ?? 3),
    cutoffMinute: 0,
    isStoreOpen: Boolean(s.isOpen),
    minimumOrderAmount: Number(s.minOrderAmount || 0),
    whatsappNumber: s.whatsapp || '',
    instapayNumber: s.instapayNumber || s.instapayHandle || '',
    vodafoneCashNumber: s.vodafoneCash || '',
    defaultDepositType: depositPercentage > 0 ? 'percentage' : 'none',
    defaultDepositValue: depositPercentage,
    allowCoupons: true,
  };
}

export async function fetchAdminProducts(): Promise<Product[]> {
  const [products, categories] = await Promise.all([
    adminPublicGet<AdminProduct[]>('/products'),
    adminPublicGet<AdminCategory[]>('/categories'),
  ]);

  const categoriesById = new Map(
    categories.map((category) => [String(category.id), category])
  );

  return products
    .map((product) => mapProduct(product, categoriesById))
    .filter((product) => product.isVisible);
}

export async function fetchAdminRegions(): Promise<DeliveryRegion[]> {
  const regions = await adminPublicGet<AdminRegion[]>('/delivery-regions');

  return regions
    .map(mapRegion)
    .filter((region) => region.isActive);
}

export async function fetchAdminSettings(): Promise<StoreSettings> {
  const settings = await adminPublicGet<AdminSettings>('/settings');
  return mapSettings(settings);
}
