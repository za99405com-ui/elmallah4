import { 
  Product, 
  Order, 
  DeliveryRegion, 
  StoreSettings, 
  CustomerUser, 
  CreateOrderPayload 
} from '../types';

const API_BASE = '/api';

// Customer Session Token Storage Helper
export const getStoredCustomerToken = (): string | null => {
  try {
    return localStorage.getItem('almallah_customer_token');
  } catch (e) {
    return null;
  }
};

export const setStoredCustomerToken = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem('almallah_customer_token', token);
    } else {
      localStorage.removeItem('almallah_customer_token');
    }
  } catch (e) {
    console.error('Failed to update customer token storage', e);
  }
};

const getCustomerAuthHeaders = (): Record<string, string> => {
  const token = getStoredCustomerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // ==========================================
  // CUSTOMER PHONE AUTHENTICATION (Egyptian Mobile & OTP)
  // ==========================================

  async sendOtp(phone: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'تعذر إرسال كود التحقق. تحقق من اتصالك بالإنترنت.' };
    }
  },

  async verifyOtp(payload: {
    phone: string;
    otp: string;
    name?: string;
    governorate?: string;
    city?: string;
    district?: string;
    address?: string;
  }) {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setStoredCustomerToken(data.token);
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل التحقق من الكود' };
    }
  },

  async getMe() {
    try {
      const token = getStoredCustomerToken();
      if (!token) return { success: false, error: 'غير مسجل الدخول' };

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getCustomerAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        setStoredCustomerToken(null);
      }
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل جلب بيانات الحساب' };
    }
  },

  async updateProfile(profile: Partial<CustomerUser>) {
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: getCustomerAuthHeaders(),
        body: JSON.stringify(profile)
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'تعذر تحديث بيانات الحساب' };
    }
  },

  async logout() {
    try {
      const token = getStoredCustomerToken();
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: getCustomerAuthHeaders()
        });
      }
    } catch (e) {
      console.warn('Logout notice:', e);
    } finally {
      setStoredCustomerToken(null);
    }
    return { success: true };
  },

  // ==========================================
  // PRODUCTS & VARIANTS
  // ==========================================

  async getProducts(params?: { category?: string; search?: string; inStock?: boolean }): Promise<{ success: boolean; data: Product[] }> {
    try {
      const query = new URLSearchParams();
      if (params?.category) query.append('category', params.category);
      if (params?.search) query.append('search', params.search);
      if (params?.inStock) query.append('inStock', 'true');

      const url = `${API_BASE}/products${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (e: any) {
      console.error('Failed to fetch products:', e);
      return { success: false, data: [] };
    }
  },

  async getProduct(id: string): Promise<{ success: boolean; data?: Product; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`);
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // ==========================================
  // REGIONS & SETTINGS
  // ==========================================

  async getRegions(): Promise<{ success: boolean; data: DeliveryRegion[] }> {
    try {
      const res = await fetch(`${API_BASE}/regions`);
      return await res.json();
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  async getSettings(): Promise<{ success: boolean; data?: StoreSettings }> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // ==========================================
  // COUPONS
  // ==========================================

  async validateCoupon(code: string, cartTotal: number) {
    try {
      const res = await fetch(`${API_BASE}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartTotal })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: 'تعذر التحقق من كود الخصم' };
    }
  },

  // ==========================================
  // ORDERS (Secure & IDOR-safe)
  // ==========================================

  async createOrder(payload: CreateOrderPayload): Promise<{ success: boolean; message?: string; data?: Order; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: getCustomerAuthHeaders(),
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل إرسال الطلب' };
    }
  },

  async getMyOrders(): Promise<{ success: boolean; count?: number; data: Order[] }> {
    try {
      const res = await fetch(`${API_BASE}/customer/orders`, {
        headers: getCustomerAuthHeaders()
      });
      return await res.json();
    } catch (e) {
      return { success: false, data: [] };
    }
  },

  async getOrder(id: string): Promise<{ success: boolean; data?: Order; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`, {
        headers: getCustomerAuthHeaders()
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // ==========================================
  // GEMINI AI CHEF ASSISTANT
  // ==========================================

  async askAiAssistant(question: string, fishType?: string, occasion?: string) {
    try {
      const res = await fetch(`${API_BASE}/ai/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, fishType, occasion })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: 'تعذر الاتصال بالمساعد الذكي' };
    }
  }
};
