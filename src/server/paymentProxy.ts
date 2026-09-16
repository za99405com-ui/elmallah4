import { Request, Response, Router } from 'express';
import {
  adminIntegrationGet,
  adminIntegrationPost,
  adminPublicGet,
  adminPublicPost,
  openAdminPaymentEventStream,
} from './adminApi.js';

export const paymentProxyRouter = Router();

type PaymentProvider = 'vf_cash' | 'bank_alahly';

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

function validProvider(value: unknown): value is PaymentProvider {
  return value === 'vf_cash' || value === 'bank_alahly';
}

paymentProxyRouter.get('/payments/config', async (_req: Request, res: Response) => {
  try {
    const data = await adminIntegrationGet<{
      defaultPaymentPolicy: 'cod_allowed' | 'deposit_required';
      sessionTimeoutSeconds: number;
      amountTolerance: number;
      providers: {
        vfCashAvailable: boolean;
        bankAlAhlyAvailable: boolean;
      };
    }>('/payments/config');

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Payment Proxy] Failed to load payment config:', err);
    return res.status(503).json({
      success: false,
      error: 'خدمة الدفع اللحظي غير متاحة حالياً. يرجى إعادة المحاولة.',
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
  const provider = req.body?.provider;

  if (!orderId || !customerPhone || !validProvider(provider)) {
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
    if (order.paymentMode === 'cash_on_delivery' || order.depositStatus === 'not_required') {
      return res.status(409).json({ success: false, error: 'هذا الطلب لا يحتاج جلسة دفع إلكتروني' });
    }

    const expectedAmount = Number(order.depositAmount || 0);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(409).json({
        success: false,
        error: 'تعذر تحديد قيمة العربون المطلوبة من الطلب المسجل',
      });
    }

    const session = await adminIntegrationPost<PaymentSessionResponse>('/payments/sessions', {
      orderId: order.id,
      customerId: order.customerId,
      customerPhone: order.customerPhone,
      provider,
      expectedAmount,
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
