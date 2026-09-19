/**
 * Compatibility adapter for the explicit Vercel /api/payments/* functions.
 *
 * The storefront now has one composition root in server.ts. Keeping this tiny
 * adapter avoids duplicating middleware/routes while preserving existing
 * serverless entrypoints.
 */
export { createServer as createPaymentServer } from './server.js';
