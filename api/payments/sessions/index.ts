import { createPaymentServer } from '../../../payment-server.js';

let appPromise: ReturnType<typeof createPaymentServer> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) appPromise = createPaymentServer();
  const app = await appPromise;
  return app(req, res);
}
