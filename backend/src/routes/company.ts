import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db';

export async function companyRoutes(app: FastifyInstance) {

  // Повний профіль компанії
  // GET /api/company/:edrpou
  app.get('/:edrpou', async (req: any, reply) => {
    const { edrpou } = req.params;

    const company = await queryOne(`
      SELECT c.*,
        -- Prozorro статистика
        (SELECT COUNT(*) FROM bids b JOIN suppliers s ON s.id=b.supplier_id WHERE s.edrpou=c.edrpou) AS bids_count,
        (SELECT COUNT(*) FROM awards a JOIN suppliers s ON s.id=a.supplier_id WHERE s.edrpou=c.edrpou AND a.status='active') AS wins_count,
        (SELECT COALESCE(SUM(a.amount),0) FROM awards a JOIN suppliers s ON s.id=a.supplier_id WHERE s.edrpou=c.edrpou AND a.status='active') AS wins_amount,
        -- Санкції
        EXISTS(SELECT 1 FROM sanctions WHERE edrpou=c.edrpou AND is_active) AS has_sanctions,
        -- Судові справи
        (SELECT COUNT(*) FROM court_cases cc WHERE cc.company_id=c.id) AS court_cases_count
      FROM companies c
      WHERE c.edrpou = $1
    `, [edrpou]);

    if (!company) return reply.status(404).send({ error: 'Компанію не знайдено' });

    // КВЕДи
    const kveds = await query(
      'SELECT kved_code, kved_name, is_primary FROM company_kveds WHERE company_id=$1 ORDER BY is_primary DESC',
      [company.id]
    );

    // Пов'язані особи
    const persons = await query(`
      SELECT
        p.id, p.full_name, p.address, p.country,
        cp.role, cp.share_pct, cp.share_amount,
        cp.influence_type, cp.ownership_type, cp.source,
        cp.is_active, cp.created_at
      FROM company_persons cp
      JOIN persons p ON p.id = cp.person_id
      WHERE cp.company_id = $1
      ORDER BY
        CASE cp.role
          WHEN 'director'    THEN 1
          WHEN 'founder'     THEN 2
          WHEN 'beneficiary' THEN 3
          WHEN 'signatory'   THEN 4
          WHEN 'accountant'  THEN 5
          ELSE 6
        END,
        cp.is_active DESC
    `, [company.id]);

    // Санкції
    const sanctions = await query(
      'SELECT * FROM sanctions WHERE edrpou=$1 ORDER BY date_added DESC',
      [edrpou]
    );

    // Судові справи
    const courts = await query(
      'SELECT * FROM court_cases WHERE company_id=$1 ORDER BY date_opened DESC LIMIT 20',
      [company.id]
    );

    // Фінанси
    const finances = await query(
      'SELECT * FROM public_finances WHERE edrpou=$1 ORDER BY period DESC LIMIT 8',
      [edrpou]
    );

    // Пов'язані компанії (по засновниках та адресі)
    const relatedByFounder = await query(`
      SELECT DISTINCT c2.edrpou, c2.name, c2.status, c2.region,
        p.full_name as via_person, cp2.role
      FROM company_persons cp1
      JOIN company_persons cp2 ON cp2.person_id = cp1.person_id AND cp2.company_id != $1
      JOIN companies c2 ON c2.id = cp2.company_id
      JOIN persons p ON p.id = cp1.person_id
      WHERE cp1.company_id = $1 AND cp1.is_active AND cp2.is_active
      LIMIT 20
    `, [company.id]);

    const relatedByAddress = company.address ? await query(`
      SELECT edrpou, name, status, legal_form
      FROM companies
      WHERE address = $1 AND edrpou != $2
      LIMIT 10
    `, [company.address, edrpou]) : [];

    return {
      company,
      kveds,
      persons,
      sanctions,
      courts,
      finances,
      related: { byFounder: relatedByFounder, byAddress: relatedByAddress },
    };
  });

  // Prozorro як учасник
  // GET /api/company/:edrpou/prozorro/participant?limit=20&offset=0&status=won
  app.get('/:edrpou/prozorro/participant', async (req: any) => {
    const { edrpou } = req.params;
    const { status, limit = 20, offset = 0, dateFrom, dateTo, amountMin, amountMax } = req.query;

    const params: any[] = [edrpou];
    const where: string[] = ['s.edrpou = $1'];

    if (status === 'won')  where.push('a.status = \'active\'');
    if (status === 'lost') where.push('a.id IS NULL');
    if (dateFrom) { params.push(dateFrom); where.push(`t.date_created >= $${params.length}`); }
    if (dateTo)   { params.push(dateTo);   where.push(`t.date_created <= $${params.length}`); }
    if (amountMin){ params.push(amountMin);where.push(`t.amount >= $${params.length}`); }
    if (amountMax){ params.push(amountMax);where.push(`t.amount <= $${params.length}`); }

    params.push(Number(limit), Number(offset));

    const rows = await query(`
      SELECT
        t.id, t.tender_id, t.title, t.status AS tender_status,
        t.amount AS expected_amount, t.currency,
        t.procurement_method_type, t.date_created, t.date_modified,
        t.cpv_code, t.cpv_description,
        b.edrpou AS buyer_edrpou, bu.name AS buyer_name,
        bu.phone AS buyer_phone, bu.email AS buyer_email,
        bid.amount AS bid_amount, bid.status AS bid_status,
        a.amount AS award_amount, a.status AS award_status,
        CASE WHEN a.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_winner,
        CASE WHEN a.amount > 0 AND t.amount > 0
          THEN ROUND((1 - a.amount/t.amount)*100, 2) ELSE NULL END AS economy_pct
      FROM tenders t
      JOIN bids bid ON bid.tender_id = t.id
      JOIN suppliers s ON s.id = bid.supplier_id
      LEFT JOIN awards a ON a.tender_id = t.id AND a.supplier_id = bid.supplier_id
      LEFT JOIN buyers bu ON bu.id = t.buyer_id
      LEFT JOIN buyers b ON b.id = t.buyer_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.date_created DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Статистика
    const [stats] = await query(`
      SELECT
        COUNT(DISTINCT t.id) AS total_bids,
        COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN t.id END) AS total_wins,
        COALESCE(SUM(CASE WHEN a.id IS NOT NULL THEN a.amount END), 0) AS wins_amount,
        MIN(t.date_created) AS first_bid,
        MIN(CASE WHEN a.id IS NOT NULL THEN t.date_created END) AS first_win
      FROM tenders t
      JOIN bids bid ON bid.tender_id = t.id
      JOIN suppliers s ON s.id = bid.supplier_id
      LEFT JOIN awards a ON a.tender_id = t.id AND a.supplier_id = bid.supplier_id
      WHERE s.edrpou = $1
    `, [edrpou]);

    return { data: rows, stats, limit: Number(limit), offset: Number(offset) };
  });

  // Prozorro як замовник
  app.get('/:edrpou/prozorro/buyer', async (req: any) => {
    const { edrpou } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const rows = await query(`
      SELECT
        t.id, t.tender_id, t.title, t.status,
        t.amount, t.currency, t.procurement_method_type,
        t.date_created, t.cpv_code, t.cpv_description,
        COUNT(DISTINCT bid.id) AS bids_count,
        COUNT(DISTINCT a.id) AS awards_count,
        MAX(a.amount) AS max_award
      FROM tenders t
      JOIN buyers bu ON bu.id = t.buyer_id
      LEFT JOIN bids bid ON bid.tender_id = t.id
      LEFT JOIN awards a ON a.tender_id = t.id
      WHERE bu.edrpou = $1
      GROUP BY t.id
      ORDER BY t.date_created DESC
      LIMIT $2 OFFSET $3
    `, [edrpou, Number(limit), Number(offset)]);

    return { data: rows };
  });

  // Конкуренти (суперники в торгах)
  app.get('/:edrpou/competitors', async (req: any) => {
    const { edrpou } = req.params;

    const rows = await query(`
      SELECT
        s2.edrpou AS competitor_edrpou,
        COALESCE(c.name, s2.name) AS competitor_name,
        COUNT(DISTINCT t.id) AS meetings,
        COUNT(DISTINCT a2.id) AS their_wins,
        MAX(t.date_created) AS last_meeting
      FROM bids b1
      JOIN suppliers s1 ON s1.id = b1.supplier_id AND s1.edrpou = $1
      JOIN bids b2 ON b2.tender_id = b1.tender_id AND b2.supplier_id != b1.supplier_id
      JOIN suppliers s2 ON s2.id = b2.supplier_id
      JOIN tenders t ON t.id = b1.tender_id
      LEFT JOIN awards a2 ON a2.tender_id = t.id AND a2.supplier_id = b2.supplier_id
      LEFT JOIN companies c ON c.edrpou = s2.edrpou
      GROUP BY s2.edrpou, s2.name, c.name
      ORDER BY meetings DESC
      LIMIT 30
    `, [edrpou]);

    return { data: rows };
  });

  // Графові дані для візуалізації зв'язків
  app.get('/:edrpou/graph', async (req: any) => {
    const { edrpou } = req.params;

    const company = await queryOne('SELECT id, name FROM companies WHERE edrpou=$1', [edrpou]);
    if (!company) return { nodes: [], edges: [] };

    const nodes: any[] = [{
      id: `c_${edrpou}`, label: company.name, type: 'company', edrpou, main: true,
    }];
    const edges: any[] = [];
    const visited = new Set([edrpou]);

    // Пов'язані особи
    const persons = await query(`
      SELECT p.id, p.full_name, cp.role, cp.share_pct
      FROM company_persons cp
      JOIN persons p ON p.id = cp.person_id
      WHERE cp.company_id = $1 AND cp.is_active
    `, [company.id]);

    for (const p of persons) {
      const nodeId = `p_${p.id}`;
      if (!nodes.find(n => n.id === nodeId)) {
        nodes.push({ id: nodeId, label: p.full_name, type: 'person', personId: p.id });
      }
      edges.push({ from: `c_${edrpou}`, to: nodeId, type: 'edr', label: p.role });

      // Інші компанії цієї особи
      const otherCompanies = await query(`
        SELECT c.edrpou, c.name, c.status, cp2.role
        FROM company_persons cp2
        JOIN companies c ON c.id = cp2.company_id
        WHERE cp2.person_id = $1 AND cp2.company_id != $2 AND cp2.is_active
        LIMIT 5
      `, [p.id, company.id]);

      for (const oc of otherCompanies) {
        if (visited.has(oc.edrpou)) continue;
        visited.add(oc.edrpou);
        nodes.push({ id: `c_${oc.edrpou}`, label: oc.name, type: 'company2', edrpou: oc.edrpou, status: oc.status });
        edges.push({ from: nodeId, to: `c_${oc.edrpou}`, type: 'edr', label: oc.role });
      }
    }

    // Топ покупців через Prozorro
    const buyers = await query(`
      SELECT DISTINCT bu.edrpou, bu.name, COUNT(t.id) as deals
      FROM tenders t
      JOIN buyers bu ON bu.id = t.buyer_id
      JOIN bids b ON b.tender_id = t.id
      JOIN suppliers s ON s.id = b.supplier_id
      WHERE s.edrpou = $1
      GROUP BY bu.edrpou, bu.name
      ORDER BY deals DESC
      LIMIT 5
    `, [edrpou]);

    for (const b of buyers) {
      const nodeId = `b_${b.edrpou}`;
      nodes.push({ id: nodeId, label: b.name, type: 'buyer', edrpou: b.edrpou, deals: b.deals });
      edges.push({ from: `c_${edrpou}`, to: nodeId, type: 'prozorro', label: `${b.deals} тендерів` });
    }

    return { nodes, edges };
  });

  // Історія змін ЄДР
  app.get('/:edrpou/history', async (req: any) => {
    const { edrpou } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const company = await queryOne('SELECT id FROM companies WHERE edrpou=$1', [edrpou]);
    if (!company) return { data: [] };

    const rows = await query(`
      SELECT field_name, old_value, new_value, changed_at, source_file
      FROM company_history
      WHERE company_id = $1
      ORDER BY changed_at DESC
      LIMIT $2 OFFSET $3
    `, [company.id, Number(limit), Number(offset)]);

    return { data: rows };
  });
}
