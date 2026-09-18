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
  PaymentMode,
  PaymentMethod,
  PaymentIntent,
  Coupon,
  DeliveryRegion,
  CreateOrderPayload,
  StoreCategory
} from '../types';
import { 
  INITIAL_SETTINGS, 
  INITIAL_REGIONS,
  fetchDeliveryRegionsFromSupabase,
  fetchStoreSettingsFromSupabase
} from '../data/initialData';
import { api, getStoredCustomerToken, setStoredCustomerToken } from '../utils/api';
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
  categories: StoreCategory[];
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
  applyCoupon: (code: string) => Promise<boolean>;
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
    district?: string;
    deliveryRegionId?: string;
    address: string;
    notes?: string;
    paymentMode?: PaymentMode;
    paymentMethod: PaymentMethod;
    paymentIntent?: PaymentIntent;
    paymentMethodCode?: string;
    customerPaymentMethodId?: string;
    depositPaid?: number;
    depositTransactionRef?: string;
  }) => Promise<Order> | Order;
  reOrder: (order: Order) => void;
  currentTrackedOrder: Order | null;
  setCurrentTrackedOrder: (order: Order | null) => void;
  resumedPaymentOrder: Order | null;
  setResumedPaymentOrder: (order: Order | null) => void;
  refreshOrders: (tokenOverride?: string) => Promise<void>;

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
  // Products are server-authoritative.
  // Do not hydrate legacy product catalog from localStorage.
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);

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

  // Coupons (Server-authoritative: browser only maintains applied coupon state)
  const [coupons, setCoupons] = useState<Coupon[]>([]);
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
  const [resumedPaymentOrder, setResumedPaymentOrder] = useState<Order | null>(null);

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

  const refreshOrders = useCallback(async (tokenOverride?: string) => {
    try {
      const token = tokenOverride || getStoredCustomerToken();
      if (!token) return;
      const res = await api.getMyOrders();
      if (res && res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch (err) {
      console.warn('Orders refresh notice:', err);
    }
  }, []);

  const syncBackend = useCallback(async () => {
    setIsLoadingData(true);
    try {
      // 1. Query backend API as primary authoritative source
      const [productsRes, categoriesRes, regionsRes, settingsRes] = await Promise.allSettled([
        api.getProducts(),
        api.getCategories(),
        api.getRegions(),
        api.getSettings()
      ]);

      if (productsRes.status === 'fulfilled' && productsRes.value?.success) {
        // Admin is authoritative even when the catalog is intentionally empty.
        setProducts(
          Array.isArray(productsRes.value.data)
            ? productsRes.value.data
            : []
        );
        setBackendConnected(true);
      }

      if (
        categoriesRes.status === 'fulfilled' &&
        categoriesRes.value?.success
      ) {
        setCategories(
          Array.isArray(categoriesRes.value.data)
            ? categoriesRes.value.data
            : []
        );
      }

      if (regionsRes.status === 'fulfilled' && regionsRes.value?.success && regionsRes.value.data?.length > 0) {
        setRegions(regionsRes.value.data);
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.success && settingsRes.value.data) {
        setStoreSettings(prev => ({ ...prev, ...settingsRes.value.data }));
      }

      // 2. Products never fall back to legacy/direct browser data.
      // Regions/settings keep their existing temporary fallback independently.
      if (
        regionsRes.status !== 'fulfilled' ||
        settingsRes.status !== 'fulfilled'
      ) {
        const [supRegions, supSettings] = await Promise.allSettled([
          fetchDeliveryRegionsFromSupabase(),
          fetchStoreSettingsFromSupabase()
        ]);

        if (
          regionsRes.status !== 'fulfilled' &&
          supRegions.status === 'fulfilled' &&
          supRegions.value.length > 0
        ) {
          setRegions(supRegions.value);
        }

        if (
          settingsRes.status !== 'fulfilled' &&
          supSettings.status === 'fulfilled' &&
          supSettings.value
        ) {
          setStoreSettings(prev => ({ ...prev, ...supSettings.value }));
        }
      }

      // 3. Restore authenticated customer and their durable historical orders
      const storedToken = getStoredCustomerToken();
      if (storedToken) {
        const meRes = await api.getMe();
        if (meRes && meRes.success && meRes.customer) {
          setCurrentUser(meRes.customer);
          // Pass valid authenticated token directly to restore orders without closure race condition
          await refreshOrders(storedToken);
        } else {
          setStoredCustomerToken(null);
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.warn('Backend sync note (using client persistence):', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [refreshOrders]);

  const loadDirectFromSupabase = useCallback(async () => {
    await syncBackend();
  }, [syncBackend]);

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

  // Coupon Actions (Server-Authoritative)
  const applyCoupon = async (code: string): Promise<boolean> => {
    setCouponError(null);
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setCouponError('يرجى إدخال كود الكوبون');
      return false;
    }

    try {
      const res = await api.validateCoupon(cleanCode, cartSubtotal);
      if (res && res.success && res.data) {
        const validated = res.data;
        const couponObj: Coupon = {
          id: `c_${validated.code}`,
          code: validated.code,
          discountType: validated.discountType,
          discountValue: validated.discountValue,
          minOrderAmount: validated.minOrderAmount,
          maxDiscount: validated.maxDiscount,
          usageLimit: 0,
          usageCount: 0,
          isActive: true
        };
        setAppliedCoupon(couponObj);
        setCouponError(null);
        return true;
      } else {
        setAppliedCoupon(null);
        setCouponError(res?.error || 'كود الخصم غير صالح أو منتهي الصلاحية');
        return false;
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err?.message || 'تعذر التحقق من كود الخصم');
      return false;
    }
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
    district?: string;
    deliveryRegionId?: string;
    address: string;
    notes?: string;
    paymentMode?: PaymentMode;
    paymentMethod: PaymentMethod;
    paymentIntent?: PaymentIntent;
    paymentMethodCode?: string;
    customerPaymentMethodId?: string;
    depositPaid?: number;
    depositTransactionRef?: string;
  }): Promise<Order> => {
    const resolvedMode: PaymentMode =
      orderData.paymentMode ||
      (orderData.paymentMethod === 'cash_on_delivery'
        ? 'cash_on_delivery'
        : 'deposit_online');

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
        district: orderData.district,
        deliveryRegionId: orderData.deliveryRegionId,
        address: orderData.address
      },
      paymentMode: resolvedMode,
      paymentMethod: orderData.paymentMethod,
      paymentIntent: orderData.paymentIntent,
      paymentMethodCode: orderData.paymentMethodCode,
      customerPaymentMethodId: orderData.customerPaymentMethodId,
      depositTransactionRef:
        resolvedMode === 'cash_on_delivery' ? undefined : orderData.depositTransactionRef,
      couponCode: appliedCoupon?.code,
      notes: orderData.notes
    };

    const serverRes = await api.createOrder(payload);

    if (!serverRes || !serverRes.success || !serverRes.data) {
      const errorMessage = serverRes?.error || 'تعذر تسجيل وتأكيد الطلب على الخادم. يرجى المحاولة مرة أخرى.';
      throw new Error(errorMessage);
    }

    const confirmedOrder: Order = {
      ...serverRes.data,
      deviceId: customerDeviceId,
      activeSession: (serverRes as any).session,
      sessionError: (serverRes as any).sessionError
    };

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
      if (res.token) {
        await refreshOrders(res.token);
      } else {
        await refreshOrders();
      }
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
    setOrders([]);
    setCurrentTrackedOrder(null);
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
        categories,
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
        resumedPaymentOrder,
        setResumedPaymentOrder,
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
