import { createServer } from '../server.js';

let appPromise: ReturnType<typeof createServer> | null = null;

export default async function handler(req: any, res: any) {
  const captured = req.query?.__path;
  const path = Array.isArray(captured) ? captured.join('/') : String(captured || '');

  // Vercel rewrites nested API paths to this single function. Restore the
  // original Express path before handing the request to the canonical app.
  req.url = path ? `/api/${path}` : '/api';

  if (!appPromise) appPromise = createServer();
  const app = await appPromise;
  return app(req, res);
}
