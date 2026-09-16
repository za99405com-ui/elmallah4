import {
  Product,
  Order,
  DeliveryRegion,
  StoreSettings,
  CustomerUser,
  CreateOrderPayload,
  StoreCategory
} from '../types';

const API_BASE = '/api';

export type PaymentSessionStatus =
  | 'waiting'
  | 'paid'
  | 'expired'
  | 'expired_needs_review'
  | 'needs_review'
  | 'cancelled';

export interface PaymentSession {
  id: string;
  clientToken: string;
  orderId: string;
  provider: 'vf_cash' | 'bank_alahly';
  expectedAmount: number;
  amountTolerance: number;
  currency: string;
  deviceId?: string;
  paymentDestination?: string;
  status: PaymentSessionStatus;
  expiresAt: string;
  timeoutSeconds?: number;
  matchedAmount?: number;
  amountDifference?: number;
  payerPhone?: string;
  paidAt?: string;
}

export interface PaymentConfig {
  defaultPaymentPolicy: 'cod_allowed' | 'deposit_required';
  sessionTimeoutSeconds: number;
  amountTolerance: number;
  providers: {
    vfCashAvailable: boolean;
    bankAlAhlyAvailable: boolean;
  };
}

const dispatchPaymentEvent = (name: string, detail: unknown) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
};

// Customer Session Token Storage Helper
export const getStoredCustomerToken = (): string | null => {
  try {
    return localStorage.getItem('almallah_customer_token');
  } catch {
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
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

async function parseJson<T>(res: Response): Promise<T> {
  return await res.json() as T;
}

async function getPaymentConfig(): Promise<{ success: boolean; data?: PaymentConfig; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/payments/config`, { cache: 'no-store' });
    return await parseJson(res);
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر تحميل إعدادات الدفع' };
  }
}

async function createPaymentSession(input: {
  orderId: string;
  customerPhone: string;
  provider: PaymentSession['provider'];
}): Promise<{ success: boolean; data?: PaymentSession; error?: string; code?: string }> {
  try {
    const res = await fetch(`${API_BASE}/payments/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return await parseJson(res);
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر إنشاء جلسة الدفع' };
  }
}

async function getPaymentSessionStatus(session: PaymentSession): Promise<PaymentSession | null> {
  try {
    const res = await fetch(
      `${API_BASE}/payments/sessions/${encodeURIComponent(session.id)}/status?token=${encodeURIComponent(session.clientToken)}`,
      { cache: 'no-store' }
    );
    const payload = await parseJson<{ success: boolean; data?: PaymentSession }>(res);
    return payload.success && payload.data ? { ...session, ...payload.data } : null;
  } catch {
    return null;
  }
}

async function waitForPaymentSession(initial: PaymentSession): Promise<PaymentSession> {
  if (typeof window === 'undefined') return initial;

  return new Promise((resolve) => {
    let current = initial;
    let settled = false;
    let pollTimer: number | null = null;
    let maxTimer: number | null = null;
    let source: EventSource | null = null;

    const terminal = new Set<PaymentSessionStatus>([
      'paid',
      'expired',
      'expired_needs_review',
      'needs_review',
      'cancelled'
    ]);

    const cleanup = () => {
      source?.close();
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (maxTimer !== null) window.clearTimeout(maxTimer);
    };

    const finish = (session: PaymentSession) => {
      if (settled) return;
      settled = true;
      current = session;
      cleanup();
      dispatchPaymentEvent('almallah:payment-session-updated', current);
      if (current.status === 'paid') {
        window.setTimeout(() => dispatchPaymentEvent('almallah:payment-session-ended', current), 900);
      }
      resolve(current);
    };

    const accept = (incoming: Partial<PaymentSession>) => {
      current = { ...current, ...incoming };
      dispatchPaymentEvent('almallah:payment-session-updated', current);
      if (terminal.has(current.status)) finish(current);
    };

    const eventsUrl = `${API_BASE}/payments/sessions/${encodeURIComponent(initial.id)}/events?token=${encodeURIComponent(initial.clientToken)}`;
    source = new EventSource(eventsUrl);

    const handleEvent = (event: MessageEvent) => {
      try {
        accept(JSON.parse(event.data));
      } catch {
        // Ignore malformed event and rely on polling fallback.
      }
    };

    source.addEventListener('payment_session_updated', handleEvent as EventListener);
    source.addEventListener('payment_confirmed', handleEvent as EventListener);

    // Polling fallback also causes the authoritative expiry sweep on admin3.
    pollTimer = window.setInterval(async () => {
      if (settled) return;
      const status = await getPaymentSessionStatus(current);
      if (status) accept(status);
    }, 4000);

    // Hard safety ceiling: session timeout + two minutes for network/review transition.
    const remaining = Math.max(0, new Date(initial.expiresAt).getTime() - Date.now());
    maxTimer = window.setTimeout(async () => {
      const status = await getPaymentSessionStatus(current);
      finish(status || { ...current, status: 'expired' });
    }, remaining + 120_000);
  });
}

export const api = {
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
      if (res.ok && data.token) setStoredCustomerToken(data.token);
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل التحقق من الكود' };
    }
  },

  async getMe() {
    try {
      const token = getStoredCustomerToken();
      if (!token) return { success: false, error: 'غير مسجل الدخول' };
      const res = await fetch(`${API_BASE}/auth/me`, { headers: getCustomerAuthHeaders() });
      const data = await res.json();
      if (!res.ok) setStoredCustomerToken(null);
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

  async getProducts(params?: { category?: string; search?: string; inStock?: boolean }): Promise<{ success: boolean; data: Product[] }> {
    try {
      const query = new URLSearchParams();
      if (params?.category) query.append('category', params.category);
      if (params?.search) query.append('search', params.search);
      if (params?.inStock) query.append('inStock', 'true');
      const url = `${API_BASE}/products${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      console.error('Failed to fetch products:', e);
      return { success: false, data: [] };
    }
  },

  async getCategories(): Promise<{ success: boolean; data: StoreCategory[] }> {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      return await res.json();
    } catch (e) {
      console.error('Failed to fetch categories:', e);
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

  async getRegions(): Promise<{ success: boolean; data: DeliveryRegion[] }> {
    try {
      const res = await fetch(`${API_BASE}/regions`);
      return await res.json();
    } catch {
      return { success: false, data: [] };
    }
  },

  async getSettings(): Promise<{ success: boolean; data?: StoreSettings }> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async getPaymentConfig() {
    return getPaymentConfig();
  },

  async createPaymentSession(input: { orderId: string; customerPhone: string; provider: PaymentSession['provider'] }) {
    return createPaymentSession(input);
  },

  async getPaymentSessionStatus(session: PaymentSession) {
    return getPaymentSessionStatus(session);
  },

  async contactPaymentSupport(session: PaymentSession) {
    try {
      const res = await fetch(`${API_BASE}/payments/sessions/${encodeURIComponent(session.id)}/contact-support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.clientToken })
      });
      const payload = await parseJson<{ success: boolean; data?: PaymentSession; error?: string }>(res);
      if (payload.success && payload.data) {
        const updated = { ...session, ...payload.data };
        dispatchPaymentEvent('almallah:payment-session-updated', updated);
        return { success: true, data: updated };
      }
      return payload;
    } catch (e: any) {
      return { success: false, error: e?.message || 'تعذر التواصل مع خدمة العملاء' };
    }
  },

  async validateCoupon(code: string, cartTotal: number) {
    try {
      const res = await fetch(`${API_BASE}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartTotal })
      });
      return await res.json();
    } catch {
      return { success: false, error: 'تعذر التحقق من كود الخصم' };
    }
  },

  async createOrder(payload: CreateOrderPayload): Promise<{ success: boolean; message?: string; data?: Order; error?: string }> {
    try {
      // Enforce the current admin3 global payment policy before durable order creation.
      const configResult = await getPaymentConfig();
      if (configResult.success && configResult.data) {
        if (configResult.data.defaultPaymentPolicy === 'deposit_required' && payload.paymentMode === 'cash_on_delivery') {
          return { success: false, error: 'العربون الإلكتروني مطلوب حالياً لإتمام الطلب.' };
        }

        if (payload.paymentMode === 'deposit_online') {
          if (payload.paymentMethod === 'card') {
            return { success: false, error: 'الدفع بالبطاقة غير مفعّل في منظومة الدفع اللحظي الحالية. اختر Vodafone Cash أو البنك الأهلي.' };
          }
          if (payload.paymentMethod === 'vodafone_cash' && !configResult.data.providers.vfCashAvailable) {
            return { success: false, error: 'لا يوجد جهاز Vodafone Cash متاح حالياً. اختر البنك الأهلي أو حاول بعد قليل.' };
          }
          if (payload.paymentMethod === 'instapay' && !configResult.data.providers.bankAlAhlyAvailable) {
            return { success: false, error: 'لا يوجد جهاز البنك الأهلي متاح حالياً. اختر Vodafone Cash أو حاول بعد قليل.' };
          }
        }
      }

      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: getCustomerAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const orderResult = await parseJson<{ success: boolean; message?: string; data?: Order; error?: string }>(res);
      if (!orderResult.success || !orderResult.data) return orderResult;

      if (payload.paymentMode !== 'deposit_online') return orderResult;

      const provider: PaymentSession['provider'] =
        payload.paymentMethod === 'vodafone_cash' ? 'vf_cash' : 'bank_alahly';

      const sessionResult = await createPaymentSession({
        orderId: orderResult.data.id,
        customerPhone: payload.deliveryAddress.customerPhone,
        provider
      });

      // The order is already durable. Never invite a duplicate order because a
      // payment device became unavailable in the short race after preflight.
      if (!sessionResult.success || !sessionResult.data) {
        dispatchPaymentEvent('almallah:payment-session-error', {
          order: orderResult.data,
          error: sessionResult.error || 'تعذر إنشاء جلسة الدفع'
        });
        return {
          ...orderResult,
          message: sessionResult.error || 'تم تسجيل الطلب، لكن تعذر تخصيص جهاز دفع حالياً.'
        };
      }

      let session = sessionResult.data;
      dispatchPaymentEvent('almallah:payment-session-started', session);
      session = await waitForPaymentSession(session);

      if (session.status === 'paid') {
        const paidAmount = Number(session.matchedAmount ?? session.expectedAmount ?? 0);
        const total = Number(orderResult.data.total || 0);
        return {
          ...orderResult,
          data: {
            ...orderResult.data,
            depositStatus: 'confirmed',
            depositPaid: paidAmount,
            remainingAmount: Math.max(0, Math.round((total - paidAmount) * 100) / 100)
          },
          message: 'تم تأكيد العربون لحظياً وتأكيد الطلب.'
        };
      }

      return {
        ...orderResult,
        message:
          session.status === 'needs_review' || session.status === 'expired_needs_review'
            ? 'تم تسجيل الطلب وتحويل الدفع للمراجعة اليدوية.'
            : 'تم تسجيل الطلب، ولم يتم تأكيد العربون خلال المهلة.'
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل إرسال الطلب' };
    }
  },

  async getMyOrders(): Promise<{ success: boolean; count?: number; data: Order[] }> {
    try {
      const res = await fetch(`${API_BASE}/customer/orders`, { headers: getCustomerAuthHeaders() });
      return await res.json();
    } catch {
      return { success: false, data: [] };
    }
  },

  async getOrder(id: string): Promise<{ success: boolean; data?: Order; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`, { headers: getCustomerAuthHeaders() });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async askAiAssistant(question: string, fishType?: string, occasion?: string) {
    try {
      const res = await fetch(`${API_BASE}/ai/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, fishType, occasion })
      });
      return await res.json();
    } catch {
      return { success: false, error: 'تعذر الاتصال بالمساعد الذكي' };
    }
  }
};
