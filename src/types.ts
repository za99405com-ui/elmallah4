export type ProductUnit = 'كيلو' | 'نصف كيلو' | 'قطعة' | 'علبة' | 'طاجن';

export type ProductCategory = string;

/**
 * Product Variant (خيار البيع والحجم وعدد القطع)
 * يسمح للصنف الواحد بأكثر من اختيار بيع (مثال: دنيس 4 قطع، 6 قطع، 8 قطع للكيلو)
 */
export interface ProductVariant {
  id: string;
  productId: string;
  label: string;                  // مثال: "وسط (4 قطع في الكيلو)" أو "كبير (قطعتين)"
  weightKg: number;               // الوزن بالكيلو (مثلاً 1)
  pieceCount: number;             // عدد القطع التقريبي
  pieceWeightMin?: number;        // الحد الأدنى لوزن القطعة بالجرام
  pieceWeightMax?: number;        // الحد الأقصى لوزن القطعة بالجرام
  price: number;                  // سعر هذا الحجم/الخيار
  originalPrice?: number;
  stockQuantity: number;          // المخزون المتاح لهذا الخيار
  isActive: boolean;              // متاح للطلب
  sortOrder: number;              // ترتيب العرض
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  originalPrice?: number;
  unit: ProductUnit;
  inStock: boolean;
  isVisible: boolean;             // إظهار/إخفاء المنتج
  sortOrder: number;              // ترتيب العرض
  image: string;
  description: string;
  
  // Custom pieces & weight configuration
  saleType: 'weight' | 'piece';   // هل البيع بالوزن أم بالقطعة
  piecesPerKiloRange?: string;    // عدد القطع التقريبي في الكيلو (مثال: 3-4 قطع / كجم)
  pieceWeightRange?: string;      // الوزن التقريبي للقطعة (مثال: 250-350 جرام)
  minOrder?: number;              // الحد الأدنى للطلب (مثال: 1 كجم)
  maxOrder?: number;              // الحد الأقصى للطلب

  // خيارات البيع والأحجام المتعددة (Variants)
  variants?: ProductVariant[];

  // Deposit settings per product
  depositType?: 'none' | 'fixed' | 'percentage';
  depositValue?: number;

  isPopular?: boolean;
  isTodayOffer?: boolean;
  isNewArrival?: boolean;
  salesCount: number;
  badgeText?: string;
}

/**
 * Cart Item:
 * معرّف فريد يجمع بين الصنف والـVariant حتى إذا طلب العميل نفس السمك بأحجام مختلفة
 * تظهر كسطور منفصلة في السلة
 */
export interface CartItem {
  id: string;                     // unique key: `${product.id}__${variant?.id || 'default'}`
  product: Product;
  variant?: ProductVariant;
  quantity: number;               // كمية بالكيلو أو بالقطعة
  notes?: string;
}

export type OrderStatus = 
  | 'new'          // 🟡 طلب جديد (قيد المراجعة)
  | 'preparing'    // 🔵 جاري التجهيز
  | 'on_delivery'  // 🟠 خرج للتوصيل
  | 'delivered'    // 🟢 تم التسليم
  | 'cancelled';   // 🔴 تم الإلغاء

export type PaymentMode = 
  | 'deposit_online'    // دفع عربون أونلاين وتأكيد الحجز
  | 'cash_on_delivery'; // الدفع بالكامل نقداً عند الاستلام

export type PaymentMethod = 
  | 'cash_on_delivery'  // الدفع عند الاستلام
  | 'card'              // بطاقة بنكية (فيزا / ماستركارد)
  | 'instapay'          // تحويل إنستاباي فوري
  | 'vodafone_cash';    // تحويل محفظة فودافون كاش

export function getPaymentMethodLabel(method?: PaymentMethod, rawMethod?: string): string {
  if (method === 'card' || rawMethod === 'card') return 'الكارت البنكي';
  if (method === 'vodafone_cash' || rawMethod === 'vodafone_cash') return 'فودافون كاش';
  if (method === 'instapay' || rawMethod === 'instapay') return 'إنستا باي';
  if (method === 'cash_on_delivery' || rawMethod === 'cash_on_delivery' || rawMethod === 'cash') return 'الدفع عند الاستلام';
  if (rawMethod) return rawMethod;
  return 'الدفع عند الاستلام';
}

export type DepositStatus = 
  | 'none'              // لا يوجد عربون
  | 'not_required'      // غير مطلوب (الدفع عند الاستلام كاش)
  | 'pending'           // في انتظار تأكيد التحويل من الإدارة
  | 'confirmed'         // تم تأكيد استلام العربون
  | 'rejected';         // تم رفض التحويل / غير صحيح

export interface OrderItem {
  productId: string;
  variantId?: string;
  variantLabel?: string;
  productName: string;
  productImage: string;
  unit: ProductUnit;
  price: number;                  // سعر الوحدة المعتمد من الخادم
  quantity: number;
  itemTotal: number;
  piecesPerKiloRange?: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  deviceId?: string;
  customerId?: string;            // المعرف الفريد للعميل لمنع التداخل وحماية الخصوصية
  customerName: string;
  customerPhone: string;
  governorate: string;
  city: string;
  district?: string;
  address: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode?: string;
  total: number;

  // Deposit & Payment Information
  paymentMode?: PaymentMode;
  paymentMethod: PaymentMethod;
  rawPaymentMethod?: string;      // القيمة الأصلية لطريقة الدفع من السجل التاريخي إن وجدت
  depositRequired: number;        // قيمة العربون المطلوب
  depositPaid: number;            // قيمة العربون المدفوع/المحول
  depositStatus: DepositStatus;   // حالة مراجعة العربون
  depositTransactionRef?: string; // رقم المعاملة أو اسم المحول
  remainingAmount: number;        // المبلغ المتبقي للسداد عند الاستلام

  status: OrderStatus;
  createdAt: string;
  deliveryTargetDate?: string;    // e.g. "اليوم مبرد" أو "غداً مبرد"
  isBeforeCutoff?: boolean;
  estimatedDeliveryTime?: string;
}

export interface CreateOrderPayload {
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    notes?: string;
  }[];
  deliveryAddress: {
    customerName: string;
    customerPhone: string;
    governorate: string;
    city: string;
    district?: string;
    address: string;
  };
  paymentMode?: PaymentMode;
  paymentMethod: PaymentMethod;
  depositPaid?: number;
  depositTransactionRef?: string;
  couponCode?: string;
  notes?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  expiryDate?: string;
  isActive: boolean;
}

export interface DeliveryRegion {
  id: string;
  governorate: string;
  cities: string[];
  deliveryFee: number;
  minOrderAmount?: number;
  estimatedTime?: string;
  isActive: boolean;
}

/**
 * Customer Identity & Account (برقم الموبايل المصري وجلسة آمنة)
 */
export interface CustomerUser {
  id: string;
  phone: string;                  // رقم الهاتف المصري المنقح (مثال: 01015192040)
  name: string;
  governorate: string;
  city: string;
  district?: string;
  address: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// Backward compatibility alias
export type UserAccount = CustomerUser;

export interface StoreCategory {
  id: string;
  name: string;

  // Admin-controlled category fields
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;

  // Legacy presentation fields kept optional for compatibility
  emoji?: string;
  image?: string;
  countBadge?: string;
}

export interface StoreSettings {
  cutoffHour: number;              // Default: 3 (3:00 AM)
  cutoffMinute: number;            // Default: 0
  isStoreOpen: boolean;            // قبول الطلبات
  minimumOrderAmount: number;      // الحد الأدنى للطلب
  whatsappNumber: string;          // رقم الواتساب (Default: 01015192040)
  instapayNumber: string;          // رقم أو حساب إنستاباي (Default: 01015192040)
  vodafoneCashNumber: string;      // رقم فودافون كاش (Default: 01015192040)
  defaultDepositType: 'fixed' | 'percentage' | 'none'; // سياسة العربون الافتراضية
  defaultDepositValue: number;     // قيمة العربون الافتراضي
  allowCoupons: boolean;           // تفعيل نظام الكوبونات
}

export interface CutoffInfo {
  isBeforeCutoff: boolean;
  cutoffTimeString: string;
  deliveryDateLabel: string;
  hoursRemaining: number;
  minutesRemaining: number;
  badgeLabel: string;
  badgeColor: string;
}

