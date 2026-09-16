import express from 'express';
import { paymentProxyRouter } from './src/server/paymentProxy.js';

/**
 * Phase 2 composition root.
 *
 * The legacy customer server is intentionally left intact. We compose the
 * payment-session proxy in front of it so `/api/payments/*` is handled before
 * Vite/static SPA fallbacks while every existing route keeps its behavior.
 */
export async function createPaymentServer() {
  const previousVercel = process.env.VERCEL;

  // Importing server.ts normally auto-starts outside Vercel. Suppress that one
  // side effect while we obtain its Express app and let this wrapper own listen().
  process.env.VERCEL = '1';
  const { createServer: createBaseServer } = await import('./server.js');
  const baseApp = await createBaseServer();

  if (previousVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = previousVercel;
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Payment proxy first; base app remains the fallback for all pre-existing APIs
  // and the SPA/static pipeline.
  app.use('/api', paymentProxyRouter);

  // The old checkout component still renders the legacy store-settings fields.
  // Mask only those two customer-facing values so no static payment number is
  // shown before admin3 assigns a device/session-specific destination.
  app.use('/api/settings', (_req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (body?.success && body?.data) {
        body = {
          ...body,
          data: {
            ...body.data,
            instapayNumber: 'يتم تخصيص الحساب تلقائياً بعد إنشاء الطلب',
            vodafoneCashNumber: 'يتم تخصيص الرقم تلقائياً بعد إنشاء الطلب',
          },
        };
      }
      return originalJson(body);
    }) as typeof res.json;
    next();
  });

  app.use(baseApp);

  return app;
}

async function start() {
  if (process.env.VERCEL) return;

  const rawPort = Number(process.env.PORT || 3000);
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 3000;
  const app = await createPaymentServer();

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Customer Payment Server] Running on port ${port}`);
  });
}

start().catch((err) => {
  console.error('[Customer Payment Server] Startup failed:', err);
  process.exit(1);
});
