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
  provider: string;
  paymentSourceId?: string;
  customerPaymentMethodId?: string;
  paymentMethodCode?: string;
  paymentIntent?: 'full_payment' | 'deposit';
  expectedAmount: number;
  amountTolerance: number;
  currency: string;
  deviceId?: string;
  paymentDestination?: string;
  accountNumber?: string;
  accountName?: string;
  status: PaymentSessionStatus;
  expiresAt: string;
  timeoutSeconds?: number;
  matchedAmount?: number;
  amountDifference?: number;
  payerPhone?: string;
  expectedPayerPhone?: string;
  payerPhoneConfirmedAt?: string;
  paidAt?: string;
}

export interface CustomerPaymentMethodConfig {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  available: boolean;
  channel: string;
  instructions?: string;
  sortOrder: number;
}

export interface PaymentConfig {
  depositPolicy: {
    enabled: boolean;
    required: boolean;
    type: 'fixed' | 'percentage';
    value: number;
    minimumDeposit: number;
  };
  paymentMethods: CustomerPaymentMethodConfig[];
  defaultPaymentPolicy: 'cod_allowed' | 'deposit_required';
  sessionTimeoutSeconds: number;
  amountTolerance: number;
  providers?: {
    vfCashAvailable: boolean;
    bankAlAhlyAvailable: boolean;
  };
}

export interface DepositCalculation {
  depositEnabled: boolean;
  depositRequired: boolean;
  depositType: 'fixed' | 'percentage';
  depositAmount: number;
  remainingAmount: number;
  totalAmount: number;
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
    const payload = await parseJson<{ success: boolean; data?: PaymentConfig; error?: string }>(res);
    if (!res.ok) return { success: false, error: payload.error || 'تعذر تحميل إعدادات الدفع' };
    return payload;
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر تحميل إعدادات الدفع' };
  }
}

async function calculateDeposit(
  totalAmount: number,
  customerPhone?: string
): Promise<{ success: boolean; data?: DepositCalculation; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/payments/calculate-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalAmount, customerPhone })
    });
    const payload = await parseJson<DepositCalculation & { error?: string }>(res);
    if (!res.ok) return { success: false, error: payload.error || 'تعذر حساب العربون' };
    return { success: true, data: payload };
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر حساب العربون' };
  }
}

async function createPaymentSession(input: {
  orderId: string;
  customerPhone: string;
  paymentMethodCode?: string;
  customerPaymentMethodId?: string;
  paymentIntent: 'full_payment' | 'deposit';
  provider?: string;
}): Promise<{ success: boolean; data?: PaymentSession; error?: string; code?: string; orderId?: string; retryable?: boolean }> {
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

export function subscribeToPaymentSession(
  initial: PaymentSession,
  onUpdate: (session: PaymentSession) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let current = initial;
  let active = true;
  let pollTimer: number | null = null;
  let source: EventSource | null = null;

  const terminal = new Set<PaymentSessionStatus>([
    'paid',
    'expired',
    'expired_needs_review',
    'needs_review',
    'cancelled'
  ]);

  const cleanup = () => {
    active = false;
    source?.close();
    if (pollTimer !== null) window.clearInterval(pollTimer);
  };

  const accept = (incoming: Partial<PaymentSession>) => {
    if (!active) return;
    current = { ...current, ...incoming };
    dispatchPaymentEvent('almallah:payment-session-updated', current);
    onUpdate(current);
    if (terminal.has(current.status)) {
      cleanup();
      if (current.status === 'paid') {
        dispatchPaymentEvent('almallah:payment-session-ended', current);
      }
    }
  };

  try {
    const eventsUrl = `${API_BASE}/payments/sessions/${encodeURIComponent(initial.id)}/events?token=${encodeURIComponent(initial.clientToken)}`;
    source = new EventSource(eventsUrl);

    const handleEvent = (event: MessageEvent) => {
      try {
        accept(JSON.parse(event.data));
      } catch {
        // Fallback to polling
      }
    };

    source.addEventListener('payment_session_updated', handleEvent as EventListener);
    source.addEventListener('payment_confirmed', handleEvent as EventListener);
    source.onmessage = handleEvent;
  } catch {
    // If EventSource fails, polling fallback handles it
  }

  // SSE is primary; use a lighter polling fallback to keep mobile/server load low.
  pollTimer = window.setInterval(async () => {
    if (!active) return;
    const status = await getPaymentSessionStatus(current);
    if (status && active) {
      accept(status);
    }
  }, 6000);

  return cleanup;
}

async function setPaymentPayerPhone(
  session: PaymentSession,
  payerPhone: string
): Promise<{ success: boolean; data?: PaymentSession; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/payments/sessions/${encodeURIComponent(session.id)}/payer-phone`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.clientToken, payerPhone })
      }
    );
    const payload = await parseJson<{ success: boolean; data?: PaymentSession; error?: string }>(res);
    if (payload.success && payload.data) {
      return { success: true, data: { ...session, ...payload.data } };
    }
    return { success: false, error: payload.error || 'تعذر حفظ رقم المحفظة المحوّلة' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر حفظ رقم المحفظة المحوّلة' };
  }
}

async function cancelPaymentSession(
  session: PaymentSession
): Promise<{ success: boolean; data?: PaymentSession; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/payments/sessions/${encodeURIComponent(session.id)}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.clientToken })
      }
    );
    const payload = await parseJson<{ success: boolean; data?: PaymentSession; error?: string }>(res);
    if (payload.success && payload.data) {
      return { success: true, data: { ...session, ...payload.data } };
    }
    return { success: false, error: payload.error || 'تعذر إلغاء عملية الدفع' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر إلغاء عملية الدفع' };
  }
}

export async function contactPaymentSupport(session: PaymentSession): Promise<{ success: boolean; data?: PaymentSession; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/payments/sessions/${encodeURIComponent(session.id)}/contact-support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.clientToken })
    });
    return await parseJson(res);
  } catch (e: any) {
    return { success: false, error: e?.message || 'تعذر إرسال طلب التواصل للدعم' };
  }
}

export {
  getPaymentConfig,
  calculateDeposit,
  createPaymentSession,
  getPaymentSessionStatus,
  waitForPaymentSession,
  setPaymentPayerPhone,
  cancelPaymentSession
};

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

  async calculateDeposit(totalAmount: number, customerPhone?: string) {
    return calculateDeposit(totalAmount, customerPhone);
  },

  async createPaymentSession(input: {
    orderId: string;
    customerPhone: string;
    paymentMethodCode?: string;
    customerPaymentMethodId?: string;
    paymentIntent: 'full_payment' | 'deposit';
    provider?: string;
  }) {
    return createPaymentSession(input);
  },

  async getPaymentSessionStatus(session: PaymentSession) {
    return getPaymentSessionStatus(session);
  },

  async setPaymentPayerPhone(session: PaymentSession, payerPhone: string) {
    const result = await setPaymentPayerPhone(session, payerPhone);
    if (result.success && result.data) {
      dispatchPaymentEvent('almallah:payment-session-updated', result.data);
    }
    return result;
  },

  async cancelPaymentSession(session: PaymentSession) {
    const result = await cancelPaymentSession(session);
    if (result.success && result.data) {
      dispatchPaymentEvent('almallah:payment-session-updated', result.data);
    }
    return result;
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

  async createOrder(payload: CreateOrderPayload): Promise<{
    success: boolean;
    message?: string;
    data?: Order;
    error?: string;
    session?: PaymentSession;
    sessionError?: string;
  }> {
    try {
      // Fail closed: payment availability is authoritative from admin3.
      const configResult = await getPaymentConfig();
      if (!configResult.success || !configResult.data) {
        return { success: false, error: configResult.error || 'تعذر تحميل طرق الدفع المتاحة حالياً.' };
      }

      const paymentMethodCode = payload.paymentMethodCode || payload.paymentMethod;
      const configuredMethod = configResult.data.paymentMethods.find(
        (method) => method.code === paymentMethodCode
      );

      if (!configuredMethod || !configuredMethod.enabled || !configuredMethod.available) {
        return { success: false, error: 'طريقة الدفع المحددة غير متاحة حالياً. اختر طريقة أخرى.' };
      }

      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: getCustomerAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const orderResult = await parseJson<{ success: boolean; message?: string; data?: Order; error?: string }>(res);
      if (!orderResult.success || !orderResult.data) return orderResult;

      if (payload.paymentMode !== 'deposit_online') return orderResult;

      const sessionResult = await createPaymentSession({
        orderId: orderResult.data.id,
        customerPhone: payload.deliveryAddress.customerPhone,
        paymentMethodCode,
        customerPaymentMethodId: payload.customerPaymentMethodId,
        paymentIntent: payload.paymentIntent === 'full_payment' ? 'full_payment' : 'deposit'
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
          sessionError: sessionResult.error || 'لا يوجد جهاز دفع متاح حالياً. تم حفظ طلبك ويمكنك إتمام الدفع أو مراجعته في صفحة طلباتي.',
          message: sessionResult.error || 'تم تسجيل الطلب، لكن تعذر تخصيص جهاز دفع حالياً.'
        };
      }

      const session = sessionResult.data;
      dispatchPaymentEvent('almallah:payment-session-started', session);

      return {
        ...orderResult,
        session,
        message: payload.paymentIntent === 'full_payment'
          ? 'تم تسجيل الطلب وجاري إكمال سداد كامل الطلب'
          : 'تم تسجيل الطلب وجاري إكمال دفع العربون'
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل إرسال الطلب' };
    }
  },

  subscribeToPaymentSession,
  waitForPaymentSession,

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

  async cancelOrder(id: string): Promise<{ success: boolean; data?: Order; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getCustomerAuthHeaders()
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'تعذر إلغاء الطلب' };
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
