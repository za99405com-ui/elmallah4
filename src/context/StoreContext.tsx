import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { 
  Product, 
  ProductVariant,
  CartItem, 
  Order, 
  OrderStatus, 
  StoreSettings, 
  CustomerUser,
  UserAccount, 
  ProductCategory,
  PaymentMethod,
  Coupon,
  DeliveryRegion,
  CreateOrderPayload
} from '../types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_SETTINGS, 
  INITIAL_COUPONS, 
  INITIAL_REGIONS,
  fetchProductsFromSupabase,
  fetchDeliveryRegionsFromSupabase,
  fetchStoreSettingsFromSupabase,
  fetchCouponsFromSupabase 
} from '../data/initialData';
import { api, getStoredCustomerToken } from '../utils/api';
import { getOrCreateDeviceId } from '../utils/device';

interface StoreContextType {
  // Navigation & Theme
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Products & Variants
  products: Product[];
  visibleProducts: Product[];
  selectedCategory: ProductCategory | 'all';
  setSelectedCategory: (cat: ProductCategory | 'all') => void;
  selectedProductForModal: Product | null;
  setSelectedProductForModal: (p: Product | null) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, variant?: ProductVariant, notes?: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  cartDepositRequired: number;

  // Coupons
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  couponDiscount: number;
  couponError: string | null;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;

  // Delivery Regions
  regions: DeliveryRegion[];
  activeRegions: DeliveryRegion[];
  selectedRegionId: string;
  setSelectedRegionId: (id: string) => void;
  currentDeliveryFee: number;

  // Orders (Private per Customer & Device)
  orders: Order[];
  createOrder: (orderData: {
    customerName: string;
    customerPhone: string;
    governorate: string;
    city: string;
    address: string;
    notes?: string;
    paymentMethod: PaymentMethod;
    depositPaid: number;
    depositTransactionRef?: string;
  }) => Promise<Order> | Order;
  reOrder: (order: Order) => void;
  currentTrackedOrder: Order | null;
  setCurrentTrackedOrder: (order: Order | null) => void;
  refreshOrders: () => Promise<void>;

  // Favorites
  favorites: string[];
  toggleFavorite: (productId: string) => void;

  // Store Settings & 3:00 AM Cutoff
  storeSettings: StoreSettings;
  updateStoreSettings: (newSettings: Partial<StoreSettings>) => void;
  cutoffInfo: {
    isBeforeCutoff: boolean;
    cutoffTimeString: string;
    deliveryDateLabel: string;
    badgeLabel: string;
  };

  // Customer Phone Authentication & Profile
  currentUser: CustomerUser | null;
  loginUser: (phone: string, name?: string) => void;
  registerUser: (user: Omit<CustomerUser, 'id' | 'createdAt'>) => void;
  logoutUser: () => Promise<void>;
  updateUserAccount: (data: Partial<CustomerUser>) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  verifyOtp: (payload: { phone: string; otp: string; name?: string; governorate?: string; city?: string; district?: string; address?: string }) => Promise<{ success: boolean; customer?: CustomerUser; error?: string }>;

  // Backend Connection & AI Chef Assistant
  backendConnected: boolean;
  isLoadingData: boolean;
  syncBackend: () => Promise<void>;
  loadDirectFromSupabase: () => Promise<void>;
  askAiAssistant: (question: string, fishType?: string, occasion?: string) => Promise<{ success: boolean; answer?: string; error?: string }>;

  // Modals & Search UI
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  isQuickCartOpen: boolean;
  setIsQuickCartOpen: (open: boolean) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('products');

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('almallah_theme');
      if (saved === 'dark' || saved === 'light') {
        if (saved === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        return saved;
      }
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('almallah_theme', theme);
    } catch {
      // ignore
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Products & Categories
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('almallah_products_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Exclude any legacy mock items
          const cleaned = parsed.filter(p => p && !['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(p.id));
          return cleaned;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PRODUCTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('almallah_products_v2', JSON.stringify(products));
    } catch {
      // ignore
    }
  }, [products]);

  const visibleProducts = useMemo(() => {
    return products
      .filter(p => p.isVisible !== false)
      .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
  }, [products]);

  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);

  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    try {
      const saved = localStorage.getItem('almallah_coupons_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_COUPONS;
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Delivery Regions
  const [regions, setRegions] = useState<DeliveryRegion[]>(() => {
    try {
      const saved = localStorage.getItem('almallah_regions_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_REGIONS;
  });

  const activeRegions = useMemo(() => regions.filter(r => r.isActive), [regions]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    return activeRegions[0]?.id || 'cairo';
  });

  // Free delivery policy
  const currentDeliveryFee = useMemo(() => 0, []);

  // Store Settings
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    try {
      const saved = localStorage.getItem('almallah_settings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          whatsappNumber: '01015192040',
          instapayNumber: parsed.instapayNumber || '01015192040',
          vodafoneCashNumber: parsed.vodafoneCashNumber || '01015192040'
        };
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('almallah_settings_v2', JSON.stringify(storeSettings));
    } catch {
      // ignore
    }
  }, [storeSettings]);

  // Customer Device ID (Anonymous isolation)
  const customerDeviceId = useMemo(() => getOrCreateDeviceId(), []);

  // Customer User (Egyptian Mobile Account)
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(() => {
    try {
      const saved = localStorage.getItem('almallah_customer_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('almallah_customer_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('almallah_customer_user');
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Orders: strictly private for this customer and device
  const [orders, setOrders] = useState<Order[]>(() => {
    const devId = getOrCreateDeviceId();
    try {
      const saved = localStorage.getItem(`almallah_orders_${devId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Exclude any legacy test orders
          return parsed.filter(o => o && o.customerName !== 'تجربة' && !o.id?.startsWith('mock'));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    if (customerDeviceId) {
      try {
        localStorage.setItem(`almallah_orders_${customerDeviceId}`, JSON.stringify(orders));
      } catch {
        // ignore
      }
    }
  }, [orders, customerDeviceId]);

  const [currentTrackedOrder, setCurrentTrackedOrder] = useState<Order | null>(null);

  // Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('almallah_favorites_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(id => !['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(id));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('almallah_favorites_v2', JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isQuickCartOpen, setIsQuickCartOpen] = useState<boolean>(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('almallah_cart_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && !['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(item.productId));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('almallah_cart_v2', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Cart Calculations with Variant support
  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const unitPrice = item.variant ? item.variant.price : item.product.price;
      return acc + unitPrice * item.quantity;
    }, 0);
  }, [cart]);

  const cartDepositRequired = useMemo(() => {
    if (cart.length === 0) return 0;
    let totalDeposit = 0;
    for (const item of cart) {
      const p = item.product;
      const unitPrice = item.variant ? item.variant.price : p.price;
      const itemSubtotal = unitPrice * item.quantity;
      if (p.depositType === 'fixed' && p.depositValue) {
        totalDeposit += p.depositValue;
      } else if (p.depositType === 'percentage' && p.depositValue) {
        totalDeposit += (itemSubtotal * p.depositValue) / 100;
      } else if (storeSettings.defaultDepositType === 'percentage') {
        totalDeposit += (itemSubtotal * (storeSettings.defaultDepositValue || 20)) / 100;
      } else if (storeSettings.defaultDepositType === 'fixed') {
        totalDeposit += (storeSettings.defaultDepositValue || 50);
      }
    }
    return Math.round(totalDeposit);
  }, [cart, storeSettings]);

  // Dynamic Coupon Discount Calculation
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.minOrderAmount && cartSubtotal < appliedCoupon.minOrderAmount) {
      return 0;
    }
    if (appliedCoupon.discountType === 'fixed') {
      return Math.min(appliedCoupon.discountValue, cartSubtotal);
    }
    if (appliedCoupon.discountType === 'percentage') {
      const calc = (cartSubtotal * appliedCoupon.discountValue) / 100;
      if (appliedCoupon.maxDiscount && calc > appliedCoupon.maxDiscount) {
        return appliedCoupon.maxDiscount;
      }
      return calc;
    }
    return 0;
  }, [appliedCoupon, cartSubtotal]);

  // Daily 3:00 AM Cutoff Calculation
  const cutoffInfo = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const isBeforeCutoff = currentHour < 3 || (currentHour === 2 && currentMinute < 60);

    return {
      isBeforeCutoff,
      cutoffTimeString: '3:00 صباحاً',
      deliveryDateLabel: isBeforeCutoff ? 'اليوم مبرد' : 'غداً مبرد',
      badgeLabel: isBeforeCutoff ? 'طازة صيد اليوم' : 'حجز صيد الغد'
    };
  }, []);

  // Backend & Supabase Sync
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  const loadDirectFromSupabase = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [supProducts, supRegions, supSettings, supCoupons] = await Promise.allSettled([
        fetchProductsFromSupabase(),
        fetchDeliveryRegionsFromSupabase(),
        fetchStoreSettingsFromSupabase(),
        fetchCouponsFromSupabase()
      ]);

      if (supProducts.status === 'fulfilled' && supProducts.value.length > 0) {
        setProducts(supProducts.value);
      }
      if (supRegions.status === 'fulfilled' && supRegions.value.length > 0) {
        setRegions(supRegions.value);
      }
      if (supSettings.status === 'fulfilled' && supSettings.value) {
        setStoreSettings(prev => ({ ...prev, ...supSettings.value }));
      }
      if (supCoupons.status === 'fulfilled' && supCoupons.value.length > 0) {
        setCoupons(supCoupons.value);
      }
    } catch (err) {
      console.warn('Direct Supabase sync notice:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      if (!currentUser) return;
      const res = await api.getMyOrders();
      if (res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch (err) {
      console.warn('Orders refresh notice:', err);
    }
  }, [currentUser]);

  const syncBackend = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Direct Supabase data fetch on app load
      let hasSupabaseData = false;
      const [supProducts, supRegions, supSettings, supCoupons] = await Promise.allSettled([
        fetchProductsFromSupabase(),
        fetchDeliveryRegionsFromSupabase(),
        fetchStoreSettingsFromSupabase(),
        fetchCouponsFromSupabase()
      ]);

      if (supProducts.status === 'fulfilled' && supProducts.value.length > 0) {
        setProducts(supProducts.value);
        hasSupabaseData = true;
      }
      if (supRegions.status === 'fulfilled' && supRegions.value.length > 0) {
        setRegions(supRegions.value);
      }
      if (supSettings.status === 'fulfilled' && supSettings.value) {
        setStoreSettings(prev => ({ ...prev, ...supSettings.value }));
      }
      if (supCoupons.status === 'fulfilled' && supCoupons.value.length > 0) {
        setCoupons(supCoupons.value);
      }

      // 2. Query backend API
      const [productsRes, regionsRes, settingsRes] = await Promise.allSettled([
        api.getProducts(),
        api.getRegions(),
        api.getSettings()
      ]);

      setBackendConnected(true);

      if (!hasSupabaseData && productsRes.status === 'fulfilled' && productsRes.value?.success && productsRes.value.data?.length > 0) {
        setProducts(productsRes.value.data);
      }
      if (regionsRes.status === 'fulfilled' && regionsRes.value?.success && regionsRes.value.data?.length > 0) {
        setRegions(regionsRes.value.data);
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.success && settingsRes.value.data) {
        setStoreSettings(prev => ({ ...prev, ...settingsRes.value.data }));
      }

      // Sync customer account if token is stored
      if (getStoredCustomerToken()) {
        const meRes = await api.getMe();
        if (meRes.success && meRes.user) {
          setCurrentUser(meRes.user);
        }
      }

      // Sync customer's orders
      await refreshOrders();
    } catch (err) {
      console.warn('Backend sync note (using client persistence):', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [refreshOrders]);

  useEffect(() => {
    syncBackend();
  }, [syncBackend]);

  // Cart Actions (Variant-Aware)
  const addToCart = (product: Product, quantity = 1, variant?: ProductVariant, notes?: string) => {
    const itemKey = `${product.id}__${variant?.id || 'default'}`;
    setCart(prev => {
      const existing = prev.find(item => item.id === itemKey || (item.product.id === product.id && item.variant?.id === variant?.id));
      if (existing) {
        return prev.map(item =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + quantity, notes: notes || item.notes }
            : item
        );
      }
      return [...prev, { id: itemKey, product, variant, quantity, notes }];
    });
  };

  const updateCartQuantity = (cartItemIdOrProdId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemIdOrProdId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.id === cartItemIdOrProdId || item.product.id === cartItemIdOrProdId) {
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const removeFromCart = (cartItemIdOrProdId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemIdOrProdId && item.product.id !== cartItemIdOrProdId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  // Coupon Actions
  const applyCoupon = (code: string): boolean => {
    setCouponError(null);
    const cleanCode = code.trim().toUpperCase();
    const found = coupons.find(c => c.code.toUpperCase() === cleanCode);

    if (!found) {
      setCouponError('كود الخصم غير صحيح');
      return false;
    }
    if (!found.isActive) {
      setCouponError('هذا الكوبون غير مفعّل حالياً');
      return false;
    }
    if (found.expiryDate && new Date(found.expiryDate) < new Date()) {
      setCouponError('انتهت صلاحية هذا الكوبون');
      return false;
    }
    if (found.usageLimit && found.usageCount >= found.usageLimit) {
      setCouponError('تم استنفاذ الحد الأقصى لاستخدام الكوبون');
      return false;
    }
    if (found.minOrderAmount && cartSubtotal < found.minOrderAmount) {
      setCouponError(`الحد الأدنى لتفعيل الكوبون هو ${found.minOrderAmount} جنيه`);
      return false;
    }

    setAppliedCoupon(found);
    return true;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  // Order Actions (Server-Authoritative with Supabase Sync)
  const createOrder = async (orderData: {
    customerName: string;
    customerPhone: string;
    governorate: string;
    city: string;
    address: string;
    notes?: string;
    paymentMethod: PaymentMethod;
    depositPaid: number;
    depositTransactionRef?: string;
  }): Promise<Order> => {
    const orderItems = cart.map(item => {
      const unitPrice = item.variant ? item.variant.price : item.product.price;
      return {
        productId: item.product.id,
        variantId: item.variant?.id,
        variantLabel: item.variant?.label,
        productName: item.product.name,
        productImage: item.product.image,
        unit: item.product.unit,
        price: unitPrice,
        quantity: item.quantity,
        itemTotal: unitPrice * item.quantity,
        piecesPerKiloRange: item.variant?.pieceCount ? `${item.variant.pieceCount} حبات للكيلو` : item.product.piecesPerKiloRange
      };
    });

    const finalSubtotal = cartSubtotal;
    const finalDelivery = currentDeliveryFee;
    const finalDiscount = couponDiscount;
    const finalTotal = Math.max(0, finalSubtotal + finalDelivery - finalDiscount);
    const finalDepositReq = Math.min(finalTotal, cartDepositRequired);
    const finalRemaining = Math.max(0, finalTotal - orderData.depositPaid);

    const localOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `#${Math.floor(1000 + Math.random() * 9000)}`,
      deviceId: customerDeviceId,
      customerId: currentUser?.id,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      governorate: orderData.governorate,
      city: orderData.city,
      address: orderData.address,
      notes: orderData.notes,
      items: orderItems,
      subtotal: finalSubtotal,
      deliveryFee: finalDelivery,
      discountAmount: finalDiscount,
      couponCode: appliedCoupon?.code,
      total: finalTotal,
      paymentMethod: orderData.paymentMethod,
      depositRequired: finalDepositReq,
      depositPaid: orderData.depositPaid,
      depositStatus: orderData.depositPaid > 0 ? 'pending' : 'none',
      depositTransactionRef: orderData.depositTransactionRef,
      remainingAmount: finalRemaining,
      status: 'new',
      createdAt: new Date().toISOString(),
      deliveryTargetDate: cutoffInfo.isBeforeCutoff ? 'اليوم مبرد' : 'غداً مبرد',
      isBeforeCutoff: cutoffInfo.isBeforeCutoff,
      estimatedDeliveryTime: 'خلال 2-4 ساعات مبرد 🚚'
    };

    // Prepare payload for authoritative backend validation & Supabase recording
    const payload: CreateOrderPayload = {
      items: cart.map(item => ({
        productId: item.product.id,
        variantId: item.variant?.id,
        quantity: item.quantity,
        notes: item.notes
      })),
      deliveryAddress: {
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        governorate: orderData.governorate,
        city: orderData.city,
        address: orderData.address
      },
      paymentMethod: orderData.paymentMethod,
      depositPaid: orderData.depositPaid,
      depositTransactionRef: orderData.depositTransactionRef,
      couponCode: appliedCoupon?.code,
      notes: orderData.notes
    };

    let confirmedOrder = localOrder;

    try {
      const serverRes = await api.createOrder(payload);
      if (serverRes.success && serverRes.data) {
        confirmedOrder = {
          ...serverRes.data,
          deviceId: customerDeviceId
        };
      }
    } catch (e) {
      console.warn('Server order creation fallback to local:', e);
    }

    setOrders(prev => [confirmedOrder, ...prev]);
    clearCart();
    setCurrentTrackedOrder(confirmedOrder);
    return confirmedOrder;
  };

  const reOrder = (order: Order) => {
    order.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod && prod.inStock) {
        const variant = prod.variants?.find(v => v.id === item.variantId);
        addToCart(prod, item.quantity, variant);
      }
    });
    setActiveTab('cart');
  };

  // Favorites Actions
  const toggleFavorite = (productId: string) => {
    setFavorites(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // Settings Actions
  const updateStoreSettings = (newSettings: Partial<StoreSettings>) => {
    setStoreSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Customer Phone Authentication Actions
  const sendOtp = async (phone: string) => {
    return await api.sendOtp(phone);
  };

  const verifyOtp = async (payload: {
    phone: string;
    otp: string;
    name?: string;
    governorate?: string;
    city?: string;
    district?: string;
    address?: string;
  }) => {
    const res = await api.verifyOtp(payload);
    if (res.success && res.customer) {
      setCurrentUser(res.customer);
      await refreshOrders();
    }
    return res;
  };

  const loginUser = (phone: string, name?: string) => {
    const user: CustomerUser = {
      id: `usr-${Date.now()}`,
      name: name || 'عميل الملاح',
      phone,
      governorate: 'القاهرة',
      city: 'مدينة نصر',
      address: '',
      createdAt: new Date().toISOString()
    };
    setCurrentUser(user);
  };

  const registerUser = (user: Omit<CustomerUser, 'id' | 'createdAt'>) => {
    const newUser: CustomerUser = {
      ...user,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setCurrentUser(newUser);
  };

  const logoutUser = async () => {
    await api.logout();
    setCurrentUser(null);
  };

  const updateUserAccount = async (data: Partial<CustomerUser>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data };
    setCurrentUser(updated);
    try {
      await api.updateProfile(data);
    } catch {
      // ignore
    }
  };

  const askAiAssistant = async (question: string, fishType?: string, occasion?: string) => {
    return await api.askAiAssistant(question, fishType, occasion);
  };

  return (
    <StoreContext.Provider
      value={{
        activeTab,
        setActiveTab,
        theme,
        toggleTheme,
        products,
        visibleProducts,
        selectedCategory,
        setSelectedCategory,
        selectedProductForModal,
        setSelectedProductForModal,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        cartSubtotal,
        cartDepositRequired,
        coupons,
        appliedCoupon,
        couponDiscount,
        couponError,
        applyCoupon,
        removeCoupon,
        regions,
        activeRegions,
        selectedRegionId,
        setSelectedRegionId,
        currentDeliveryFee,
        orders,
        createOrder,
        reOrder,
        currentTrackedOrder,
        setCurrentTrackedOrder,
        refreshOrders,
        favorites,
        toggleFavorite,
        storeSettings,
        updateStoreSettings,
        cutoffInfo,
        currentUser,
        loginUser,
        registerUser,
        logoutUser,
        updateUserAccount,
        sendOtp,
        verifyOtp,
        backendConnected,
        isLoadingData,
        syncBackend,
        loadDirectFromSupabase,
        askAiAssistant,
        isSearchOpen,
        setIsSearchOpen,
        isQuickCartOpen,
        setIsQuickCartOpen
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
