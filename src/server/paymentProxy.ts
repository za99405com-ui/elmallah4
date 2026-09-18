import { Request, Response, Router } from 'express';
import {
  adminIntegrationGet,
  adminIntegrationPost,
  adminPublicGet,
  adminPublicPost,
  openAdminPaymentEventStream,
} from './adminApi.js';

export const paymentProxyRouter = Router();

type PaymentProvider = string;

interface AdminOrderLookup {
  order: {
    id: string;
    orderNumber: string;
    customerId?: string;
    customerPhone: string;
    paymentMode?: 'deposit_online' | 'cash_on_delivery';
    depositAmount: number;
    depositStatus?: string;
    totalAmount: number;
  };
}

interface PaymentSessionResponse {
  id: string;
  clientToken: string;
  orderId: string;
  customerId?: string;
  customerPhone?: string;
  provider: PaymentProvider;
  expectedAmount: number;
  amountTolerance: number;
  currency: string;
  deviceId?: string;
  paymentDestination?: string;
  status: string;
  expiresAt: string;
  timeoutSeconds?: number;
  matchedAmount?: number;
  amountDifference?: number;
  paidAt?: string;
}

function normalizeEgyptianPhone(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && /^1[0125]/.test(digits)) digits = `0${digits}`;
  return digits;
}

function validLegacyProvider(value: unknown): value is PaymentProvider {
  return value === 'vf_cash' || value === 'bank_alahly';
}

function legacyProviderForMethod(methodCode: string): PaymentProvider | undefined {
  if (methodCode === 'vodafone_cash' || methodCode === 'vf_cash') return 'vf_cash';
  if (methodCode === 'instapay' || methodCode === 'bank_transfer' || methodCode === 'bank_alahly') return 'bank_alahly';
  return undefined;
}

paymentProxyRouter.get('/payments/config', async (_req: Request, res: Response) => {
  try {
    const data = await adminIntegrationGet<any>('/payments/config');
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Payment Proxy] Failed to load payment config:', err);
    return res.status(503).json({
      success: false,
      error: 'خدمة الدفع اللحظي غير متاحة حالياً. يرجى إعادة المحاولة.',
    });
  }
});

paymentProxyRouter.post('/payments/calculate-deposit', async (req: Request, res: Response) => {
  const totalAmount = Number(req.body?.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return res.status(400).json({ error: 'إجمالي الطلب غير صالح' });
  }

  try {
    const data = await adminIntegrationPost<any>('/payments/calculate-deposit', {
      totalAmount,
      customerPhone: req.body?.customerPhone,
      customerId: req.body?.customerId,
    });
    return res.json(data);
  } catch (err: any) {
    const status = Number(err?.status || 503);
    return res.status(status >= 400 && status < 600 ? status : 503).json({
      error: err?.payload?.error || err?.message || 'تعذر حساب العربون المطلوب',
    });
  }
});

/**
 * Creates a payment session after re-reading the order from admin3. The browser
 * never supplies the authoritative expected amount; it is derived from the
 * server-owned order deposit amount.
 */
paymentProxyRouter.post('/payments/sessions', async (req: Request, res: Response) => {
  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
  const customerPhone = normalizeEgyptianPhone(req.body?.customerPhone);
  const paymentMethodCode = typeof req.body?.paymentMethodCode === 'string' ? req.body.paymentMethodCode.trim() : '';
  const customerPaymentMethodId = typeof req.body?.customerPaymentMethodId === 'string' ? req.body.customerPaymentMethodId.trim() : '';
  const explicitProvider = validLegacyProvider(req.body?.provider) ? req.body.provider : undefined;
  // Modern flow sends the customer-facing payment method to admin3 and lets
  // admin3 choose the internal source/device. Legacy provider mapping is used
  // only when no customer payment method identity was supplied.
  const provider =
    explicitProvider ||
    (!paymentMethodCode && !customerPaymentMethodId
      ? legacyProviderForMethod(String(req.body?.paymentMethod || ''))
      : undefined);

  if (!orderId || !customerPhone || (!paymentMethodCode && !customerPaymentMethodId && !provider)) {
    return res.status(400).json({ success: false, error: 'بيانات جلسة الدفع غير صالحة' });
  }

  try {
    // Ownership check + authoritative payment amount from admin3.
    const lookup = await adminIntegrationPost<AdminOrderLookup>('/integration/orders/lookup', {
      orderIdOrNumber: orderId,
      phone: customerPhone,
    });

    const order = lookup.order;
    if (!order || normalizeEgyptianPhone(order.customerPhone) !== customerPhone) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }
    const isFullPayment =
      req.body?.paymentIntent === 'full_payment' ||
      (order.depositAmount >= order.totalAmount && order.totalAmount > 0);

    if (order.paymentMode === 'cash_on_delivery') {
      return res.status(409).json({ success: false, error: 'هذا الطلب لا يحتاج جلسة دفع إلكتروني' });
    }

    if (!isFullPayment && order.depositStatus === 'not_required') {
      return res.status(409).json({ success: false, error: 'هذا الطلب لا يحتاج جلسة عربون إلكتروني' });
    }

    const expectedAmount = isFullPayment ? Number(order.totalAmount || 0) : Number(order.depositAmount || 0);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(409).json({
        success: false,
        error: isFullPayment ? 'تعذر تحديد إجمالي الطلب المطلوب للسداد الإلكتروني' : 'تعذر تحديد قيمة العربون المطلوبة من الطلب المسجل',
      });
    }

    const session = await adminIntegrationPost<PaymentSessionResponse>('/payments/sessions', {
      orderId: order.id,
      customerId: order.customerId,
      customerPhone: order.customerPhone,
      ...(provider ? { provider } : {}),
      expectedAmount,
      paymentIntent: isFullPayment ? 'full_payment' : 'deposit',
      paymentMethodCode: paymentMethodCode || undefined,
      customerPaymentMethodId: customerPaymentMethodId || undefined,
    });

    return res.status(201).json({ success: true, data: session });
  } catch (err: any) {
    const status = Number(err?.status || 0);
    const payload = err?.payload as any;

    if (status === 404) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
    }
    if (status === 503 && payload?.error === 'no_payment_device_available') {
      return res.status(503).json({
        success: false,
        error: 'لا يوجد جهاز دفع متاح حالياً. حاول مرة أخرى بعد قليل أو تواصل مع خدمة العملاء.',
        code: 'no_payment_device_available',
        orderId: payload?.orderId || orderId,
        retryable: payload?.retryable !== false,
      });
    }

    console.error('[Payment Proxy] Session creation failed:', err);
    return res.status(status >= 400 && status < 600 ? status : 503).json({
      success: false,
      error: err?.message || 'تعذر إنشاء جلسة الدفع اللحظي',
    });
  }
});

paymentProxyRouter.get('/payments/sessions/:id/status', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) return res.status(401).json({ success: false, error: 'Payment session token required' });

  try {
    const data = await adminPublicGet<PaymentSessionResponse>(
      `/payments/sessions/${encodeURIComponent(req.params.id)}/status?token=${encodeURIComponent(token)}`
    );
    return res.json({ success: true, data });
  } catch (err: any) {
    const status = Number(err?.status || 503);
    return res.status(status).json({ success: false, error: err?.message || 'تعذر تحديث حالة الدفع' });
  }
});

paymentProxyRouter.post('/payments/sessions/:id/contact-support', async (req: Request, res: Response) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token) return res.status(401).json({ success: false, error: 'Payment session token required' });

  try {
    const data = await adminPublicPost<PaymentSessionResponse>(
      `/payments/sessions/${encodeURIComponent(req.params.id)}/contact-support?token=${encodeURIComponent(token)}`,
      {}
    );
    return res.json({ success: true, data });
  } catch (err: any) {
    const status = Number(err?.status || 503);
    return res.status(status).json({ success: false, error: err?.message || 'تعذر إرسال طلب التواصل للدعم' });
  }
});

/**
 * Same-origin SSE proxy. The browser only knows the session-scoped client token;
 * ADMIN_INTEGRATION_KEY remains server-only.
 */
paymentProxyRouter.get('/payments/sessions/:id/events', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) return res.status(401).json({ error: 'Payment session token required' });

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const upstream = await openAdminPaymentEventStream(req.params.id, token, controller.signal);
    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).json({ error: 'Payment realtime stream unavailable' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const reader = upstream.body.getReader();
    while (!controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } catch (err: any) {
    if (!controller.signal.aborted) {
      console.warn('[Payment Proxy] SSE proxy ended:', err?.message || err);
      if (!res.headersSent) res.status(502).json({ error: 'Payment realtime stream unavailable' });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});
