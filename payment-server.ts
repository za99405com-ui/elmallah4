import express from 'express';
import { paymentProxyRouter } from './src/server/paymentProxy.js';

/**
 * Lightweight payment composition root.
 *
 * Vercel has explicit /api/payments/* functions, so those functions must not
 * initialize the full storefront server (catalog, coupons, regions, settings)
 * on every cold start. Local development can still fall back to the full app.
 */
export async function createPaymentServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Payment routes are fully self-contained and talk server-to-server to admin3.
  app.use('/api', paymentProxyRouter);

  // On Vercel this app is used only by explicit payment serverless functions.
  // Returning here avoids loading the complete storefront on every payment call.
  if (process.env.VERCEL) {
    return app;
  }

  // Local development keeps the old fallback composition so one process can
  // still serve the whole storefront.
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  const { createServer: createBaseServer } = await import('./server.js');
  const baseApp = await createBaseServer();

  if (previousVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = previousVercel;
  }

  // Mask legacy static payment values when the local full app handles settings.
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
