import { createServer } from '../server';

let appPromise: ReturnType<typeof createServer> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = createServer();
  }

  const app = await appPromise;
  return app(req, res);
}
