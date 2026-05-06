import { FastifyInstance } from 'fastify';
import { query } from '../db';

export async function searchRoutes(app: FastifyInstance) {

  // Пошук компаній та ФОП
  // GET /api/search/companies?q=весна&region=Дніпро&status=зареєстровано&limit=20&offset=0
  app.get('/companies', async (req: any) => {
    const { q, region, status, kved, limit = 20, offset = 0 } = req.query;
    const params: any[] = [];
    const where: string[] = [];

    if (q) {
      params.push(q);
      where.push(`(
        to_tsvector('simple', c.name) @@ plainto_tsquery('simple', $${params.length})
        OR c.edrpou ILIKE $${params.length} || '%'
        OR c.short_name ILIKE '%' || $${params.length} || '%'
      )`);
    }
    if (region)  { params.push(`%${region}%`);  where.push(`c.region ILIKE $${params.length}`); }
    if (status)  { params.push(status);           where.push(`c.status = $${params.length}`); }
    if (kved)    { params.push(kved);             where.push(`c.primary_kved = $${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(Number(limit), Number(offset));
    const limitN  = params.length - 1;
    const offsetN = params.length;

    const rows = await query(`
      SELECT
        c.id, c.edrpou, c.name, c.short_name, c.legal_form,
        c.status, c.region, c.locality, c.phone, c.email,
        c.primary_kved, c.primary_kved_name,
        c.registration_date, c.updated_at,
        -- Чи є в Prozorro
        EXISTS(SELECT 1 FROM tenders t WHERE t.buyer_id = (
          SELECT b.id FROM buyers b WHERE b.edrpou = c.edrpou LIMIT 1
        )) AS is_buyer,
        EXISTS(SELECT 1 FROM suppliers s WHERE s.edrpou = c.edrpou LIMIT 1) AS is_supplier,
        -- Санкції
        EXISTS(SELECT 1 FROM sanctions s WHERE s.edrpou = c.edrpou AND s.is_active) AS has_sanctions
      FROM companies c
      ${whereClause}
      ORDER BY
        CASE WHEN c.status='зареєстровано' THEN 0 ELSE 1 END,
        c.name
      LIMIT $${limitN} OFFSET $${offsetN}
    `, params);

    // Загальна кількість
    const countParams = params.slice(0, -2);
    const [{ count }] = await query(
      `SELECT COUNT(*) as count FROM companies c ${whereClause}`,
      countParams
    );

    return { data: rows, total: Number(count), limit: Number(limit), offset: Number(offset) };
  });

  // Пошук фізичних осіб
  // GET /api/search/persons?q=сендецький
  app.get('/persons', async (req: any) => {
    const { q, limit = 20, offset = 0 } = req.query;
    if (!q) return { data: [], total: 0 };

    const rows = await query(`
      SELECT
        p.id, p.full_name, p.address, p.country,
        COUNT(DISTINCT cp.company_id) as companies_count,
        ARRAY_AGG(DISTINCT cp.role) as roles
      FROM persons p
      LEFT JOIN company_persons cp ON cp.person_id = p.id AND cp.is_active
      WHERE to_tsvector('simple', p.full_name) @@ plainto_tsquery('simple', $1)
        OR p.full_name ILIKE '%' || $1 || '%'
      GROUP BY p.id, p.full_name, p.address, p.country
      ORDER BY companies_count DESC
      LIMIT $2 OFFSET $3
    `, [q, Number(limit), Number(offset)]);

    return { data: rows, limit: Number(limit), offset: Number(offset) };
  });

  // Швидкий пошук (autocomplete) — топ 8 результатів
  // GET /api/search/quick?q=весна
  app.get('/quick', async (req: any) => {
    const { q } = req.query;
    if (!q || String(q).length < 2) return { companies: [], persons: [] };

    const [companies, persons] = await Promise.all([
      query(`
        SELECT edrpou, name, short_name, status, region, legal_form
        FROM companies
        WHERE name ILIKE $1 OR edrpou ILIKE $2 OR short_name ILIKE $1
        ORDER BY CASE WHEN status='зареєстровано' THEN 0 ELSE 1 END
        LIMIT 6
      `, [`%${q}%`, `${q}%`]),

      query(`
        SELECT p.id, p.full_name, COUNT(cp.company_id) as co
        FROM persons p
        LEFT JOIN company_persons cp ON cp.person_id=p.id
        WHERE p.full_name ILIKE $1
        GROUP BY p.id
        LIMIT 4
      `, [`%${q}%`]),
    ]);

    return { companies, persons };
  });
}
