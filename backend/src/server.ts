import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';

import { searchRoutes }    from './routes/search';
import { companyRoutes }   from './routes/company';
import { personRoutes, tenderRoutes, analyticsRoutes, exportRoutes } from './routes/combined';

const app = Fastify({ logger: process.env.NODE_ENV !== 'production' });

async function start() {
  // Plugins
  await app.register(cors, { origin: '*' });
  await app.register(compress);
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  // Health check
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Routes
  await app.register(searchRoutes,    { prefix: '/api/search' });
  await app.register(companyRoutes,   { prefix: '/api/company' });
  await app.register(personRoutes,    { prefix: '/api/person' });
  await app.register(tenderRoutes,    { prefix: '/api/tenders' });
  await app.register(analyticsRoutes, { prefix: '/api/analytics' });
  await app.register(exportRoutes,    { prefix: '/api/export' });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 API running on http://localhost:${port}`);
}

start().catch(err => { console.error(err); process.exit(1); });
