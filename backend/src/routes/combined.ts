// ─── PERSON ROUTES ───────────────────────────────────────────
import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { stringify } from 'csv-stringify/sync';

export async function personRoutes(app: FastifyInstance) {
  app.get('/:id', async (req: any, reply) => {
    const person = await queryOne('SELECT * FROM persons WHERE id=$1', [req.params.id]);
    if (!person) return reply.status(404).send({ error: 'Особу не знайдено' });

    const companies = await query(`
      SELECT c.edrpou, c.name, c.status, c.region, c.legal_form,
        cp.role, cp.share_pct, cp.share_amount, cp.is_active
      FROM company_persons cp
      JOIN companies c ON c.id = cp.company_id
      WHERE cp.person_id = $1
      ORDER BY cp.is_active DESC, c.name
    `, [person.id]);

    const tenderContacts = await query(`
      SELECT DISTINCT t.id, t.title, t.date_created, bu.name AS buyer
      FROM tenders t
      JOIN buyers bu ON bu.id = t.buyer_id
      WHERE bu.email ILIKE $1 OR bu.phone ILIKE $1
      LIMIT 20
    `, [`%${person.full_name}%`]);

    return { person, companies, tenderContacts };
  });
}

// ─── TENDER ROUTES ───────────────────────────────────────────
export async function tenderRoutes(app: FastifyInstance) {
  // Пошук тендерів
  app.get('/', async (req: any) => {
    const {
      q, status, buyerEdrpou, supplierEdrpou, cpv,
      region, amountMin, amountMax, dateFrom, dateTo,
      procMethod, sortBy = 'date_created', sortDir = 'desc',
      limit = 20, offset = 0,
    } = req.query;

    const params: any[] = [];
    const where: string[] = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(t.title ILIKE $${params.length} OR t.tender_id ILIKE $${params.length})`);
    }
    if (status)       { params.push(status);         where.push(`t.status=$${params.length}`); }
    if (buyerEdrpou)  { params.push(buyerEdrpou);    where.push(`bu.edrpou=$${params.length}`); }
    if (supplierEdrpou){ params.push(supplierEdrpou); where.push(`s.edrpou=$${params.length}`); }
    if (cpv)          { params.push(`${cpv}%`);      where.push(`t.cpv_code LIKE $${params.length}`); }
    if (region)       { params.push(`%${region}%`);  where.push(`bu.region ILIKE $${params.length}`); }
    if (amountMin)    { params.push(amountMin);       where.push(`t.amount>=$${params.length}`); }
    if (amountMax)    { params.push(amountMax);       where.push(`t.amount<=$${params.length}`); }
    if (dateFrom)     { params.push(dateFrom);        where.push(`t.date_created>=$${params.length}`); }
    if (dateTo)       { params.push(dateTo);          where.push(`t.date_created<=$${params.length}`); }
    if (procMethod)   { params.push(procMethod);      where.push(`t.procurement_method_type=$${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safeSortBy  = ['date_created','amount','date_modified'].includes(sortBy) ? sortBy : 'date_created';
    const safeSortDir = sortDir === 'asc' ? 'ASC' : 'DESC';

    params.push(Number(limit), Number(offset));

    const rows = await query(`
      SELECT
        t.id, t.tender_id, t.title, t.status,
        t.amount, t.currency, t.procurement_method_type,
        t.cpv_code, t.cpv_description,
        t.date_created, t.date_modified,
        bu.edrpou AS buyer_edrpou, bu.name AS buyer_name,
        bu.phone AS buyer_phone, bu.email AS buyer_email,
        COUNT(DISTINCT bid.id) AS bids_count,
        s.edrpou AS winner_edrpou, s.name AS winner_name,
        a.amount AS award_amount,
        CASE WHEN a.amount>0 AND t.amount>0
          THEN ROUND((1-a.amount/t.amount)*100,2) ELSE NULL END AS economy_pct
      FROM tenders t
      LEFT JOIN buyers bu ON bu.id = t.buyer_id
      LEFT JOIN bids bid ON bid.tender_id = t.id
      LEFT JOIN awards a ON a.tender_id = t.id AND a.status='active'
      LEFT JOIN suppliers s ON s.id = a.supplier_id
      ${whereClause}
      GROUP BY t.id, bu.edrpou, bu.name, bu.phone, bu.email,
        s.edrpou, s.name, a.amount
      ORDER BY t.${safeSortBy} ${safeSortDir}
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    const [{ count }] = await query(
      `SELECT COUNT(DISTINCT t.id) AS count FROM tenders t
       LEFT JOIN buyers bu ON bu.id=t.buyer_id
       LEFT JOIN bids bid ON bid.tender_id=t.id
       LEFT JOIN suppliers s ON s.id=bid.supplier_id
       ${whereClause}`,
      params.slice(0, -2)
    );

    return { data: rows, total: Number(count), limit: Number(limit), offset: Number(offset) };
  });

  // Один тендер з деталями
  app.get('/:id', async (req: any, reply) => {
    const tender = await queryOne(`
      SELECT t.*, bu.edrpou AS buyer_edrpou, bu.name AS buyer_name,
        bu.address AS buyer_address, bu.phone AS buyer_phone, bu.email AS buyer_email
      FROM tenders t
      LEFT JOIN buyers bu ON bu.id = t.buyer_id
      WHERE t.id=$1
    `, [req.params.id]);
    if (!tender) return reply.status(404).send({ error: 'Not found' });

    const bids = await query(`
      SELECT bid.id, bid.amount, bid.status, bid.bid_date,
        s.edrpou, s.name, s.phone, s.email,
        CASE WHEN a.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_winner
      FROM bids bid
      JOIN suppliers s ON s.id=bid.supplier_id
      LEFT JOIN awards a ON a.tender_id=bid.tender_id AND a.supplier_id=bid.supplier_id
      WHERE bid.tender_id=$1
      ORDER BY bid.amount
    `, [req.params.id]);

    const items = await query(
      'SELECT * FROM tender_items WHERE tender_id=$1',
      [req.params.id]
    );

    return { tender, bids, items };
  });
}

// ─── ANALYTICS ROUTES ────────────────────────────────────────
export async function analyticsRoutes(app: FastifyInstance) {
  // Топ переможців
  app.get('/top-winners', async (req: any) => {
    const { limit = 10, cpv, region, year } = req.query;
    const params: any[] = [];
    const where: string[] = [];

    if (cpv)    { params.push(`${cpv}%`); where.push(`t.cpv_code LIKE $${params.length}`); }
    if (region) { params.push(`%${region}%`); where.push(`bu.region ILIKE $${params.length}`); }
    if (year)   { params.push(year); where.push(`EXTRACT(YEAR FROM t.date_created)=$${params.length}`); }

    const wc = where.length ? `AND ${where.join(' AND ')}` : '';
    params.push(Number(limit));

    return query(`
      SELECT s.edrpou, COALESCE(c.name,s.name) AS name,
        COUNT(DISTINCT a.id) AS wins,
        SUM(a.amount) AS total_amount,
        AVG(a.amount) AS avg_amount
      FROM awards a
      JOIN suppliers s ON s.id=a.supplier_id
      JOIN tenders t ON t.id=a.tender_id
      LEFT JOIN buyers bu ON bu.id=t.buyer_id
      LEFT JOIN companies c ON c.edrpou=s.edrpou
      WHERE a.status='active' ${wc}
      GROUP BY s.edrpou, s.name, c.name
      ORDER BY total_amount DESC
      LIMIT $${params.length}
    `, params);
  });

  // Статистика по регіонах
  app.get('/by-region', async () => query(`
    SELECT bu.region,
      COUNT(DISTINCT t.id) AS tenders,
      SUM(t.amount) AS total_amount,
      COUNT(DISTINCT a.id) AS awards
    FROM tenders t
    LEFT JOIN buyers bu ON bu.id=t.buyer_id
    LEFT JOIN awards a ON a.tender_id=t.id
    WHERE bu.region IS NOT NULL
    GROUP BY bu.region
    ORDER BY total_amount DESC
  `));

  // Динаміка по місяцях
  app.get('/monthly', async (req: any) => {
    const { edrpou, role = 'supplier', months = 24 } = req.query;
    if (!edrpou) return [];

    if (role === 'supplier') {
      return query(`
        SELECT
          TO_CHAR(t.date_created,'YYYY-MM') AS month,
          COUNT(DISTINCT t.id) AS bids,
          COUNT(DISTINCT a.id) AS wins,
          COALESCE(SUM(a.amount),0) AS amount
        FROM tenders t
        JOIN bids b ON b.tender_id=t.id
        JOIN suppliers s ON s.id=b.supplier_id AND s.edrpou=$1
        LEFT JOIN awards a ON a.tender_id=t.id AND a.supplier_id=b.supplier_id
        WHERE t.date_created >= NOW()-($2::int * INTERVAL '1 month')
        GROUP BY month ORDER BY month
      `, [edrpou, Number(months)]);
    }
    return query(`
      SELECT TO_CHAR(t.date_created,'YYYY-MM') AS month,
        COUNT(DISTINCT t.id) AS tenders,
        COALESCE(SUM(t.amount),0) AS amount
      FROM tenders t JOIN buyers bu ON bu.id=t.buyer_id
      WHERE bu.edrpou=$1 AND t.date_created>=NOW()-($2::int*INTERVAL '1 month')
      GROUP BY month ORDER BY month
    `, [edrpou, Number(months)]);
  });
}

// ─── EXPORT ROUTES ───────────────────────────────────────────
export async function exportRoutes(app: FastifyInstance) {

  // Спільна функція отримання даних тендерів
  async function fetchTendersForExport(queryParams: any) {
    const { edrpou, role, limit = 1000 } = queryParams;
    if (!edrpou) return [];

    if (role === 'supplier') {
      return query(`
        SELECT t.tender_id, t.title, t.status, t.amount AS expected,
          a.amount AS contract, t.procurement_method_type AS procedure,
          bu.name AS buyer, bu.edrpou AS buyer_edrpou,
          bu.phone AS buyer_phone, bu.email AS buyer_email,
          t.cpv_code, t.date_created, t.date_modified,
          CASE WHEN a.id IS NOT NULL THEN 'Переможець' ELSE 'Учасник' END AS result,
          CASE WHEN a.amount>0 AND t.amount>0
            THEN ROUND((1-a.amount/t.amount)*100,2) ELSE NULL END AS economy_pct
        FROM tenders t
        JOIN bids b ON b.tender_id=t.id
        JOIN suppliers s ON s.id=b.supplier_id AND s.edrpou=$1
        LEFT JOIN awards a ON a.tender_id=t.id AND a.supplier_id=b.supplier_id
        LEFT JOIN buyers bu ON bu.id=t.buyer_id
        ORDER BY t.date_created DESC LIMIT $2
      `, [edrpou, Number(limit)]);
    }
    return [];
  }

  // Excel (.xlsx)
  app.get('/xlsx', async (req: any, reply) => {
    const rows = await fetchTendersForExport(req.query);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Тендери');

    ws.columns = [
      { header: 'ID тендера',     key: 'tender_id',    width: 28 },
      { header: 'Назва',          key: 'title',        width: 40 },
      { header: 'Статус',         key: 'status',       width: 16 },
      { header: 'Очікувана',      key: 'expected',     width: 16 },
      { header: 'Договір',        key: 'contract',     width: 16 },
      { header: 'Економія %',     key: 'economy_pct',  width: 12 },
      { header: 'Результат',      key: 'result',       width: 14 },
      { header: 'Замовник',       key: 'buyer',        width: 40 },
      { header: 'ЄДРПОУ замовника',key:'buyer_edrpou', width: 14 },
      { header: 'Телефон',        key: 'buyer_phone',  width: 18 },
      { header: 'Email',          key: 'buyer_email',  width: 26 },
      { header: 'CPV',            key: 'cpv_code',     width: 12 },
      { header: 'Дата',           key: 'date_created', width: 14 },
    ];

    // Стиль заголовків
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1E40AF' } };
    ws.getRow(1).font = { bold: true, color:{ argb:'FFFFFFFF' } };

    rows.forEach(r => ws.addRow(r));

    // Чергування кольорів рядків
    ws.eachRow((row, i) => {
      if (i > 1) {
        row.fill = { type:'pattern', pattern:'solid',
          fgColor:{ argb: i%2===0 ? 'FFF0F9FF' : 'FFFFFFFF' } };
      }
    });

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="tenders_${Date.now()}.xlsx"`);
    const buf = await wb.xlsx.writeBuffer();
    return reply.send(buf);
  });

  // CSV
  app.get('/csv', async (req: any, reply) => {
    const rows = await fetchTendersForExport(req.query);
    const csv = stringify(rows, {
      header: true,
      columns: {
        tender_id:'ID тендера', title:'Назва', status:'Статус',
        expected:'Очікувана вартість', contract:'Договір',
        economy_pct:'Економія %', result:'Результат',
        buyer:'Замовник', buyer_edrpou:'ЄДРПОУ', buyer_phone:'Телефон',
        buyer_email:'Email', cpv_code:'CPV', date_created:'Дата',
      },
      bom: true, // UTF-8 BOM для Excel
    });

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="tenders_${Date.now()}.csv"`);
    return reply.send(csv);
  });

  // PDF
  app.get('/pdf', async (req: any, reply) => {
    const rows = await fetchTendersForExport({ ...req.query, limit: 100 });
    const edrpou = req.query.edrpou ?? '';

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Заголовок
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Звіт по тендерах — ЄДРПОУ ${edrpou}`, 14, 16);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Сформовано: ${new Date().toLocaleString('uk-UA')}  |  Записів: ${rows.length}`, 14, 22);

    // Таблиця
    let y = 30;
    const cols = [
      { h: 'ID', w: 50, k: 'tender_id' },
      { h: 'Назва', w: 70, k: 'title' },
      { h: 'Статус', w: 24, k: 'status' },
      { h: 'Сума', w: 26, k: 'expected' },
      { h: 'Результат', w: 24, k: 'result' },
      { h: 'Замовник', w: 60, k: 'buyer' },
      { h: 'Дата', w: 22, k: 'date_created' },
    ];

    // Header row
    doc.setFillColor(30, 64, 175);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y, 255, 7, 'F');
    let x = 14;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    cols.forEach(c => { doc.text(c.h, x+1, y+5); x += c.w; });
    y += 7;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);

    rows.slice(0, 60).forEach((row, i) => {
      if (y > 185) { doc.addPage(); y = 20; }
      if (i % 2 === 0) { doc.setFillColor(240, 249, 255); doc.rect(14, y, 255, 6, 'F'); }
      x = 14;
      cols.forEach(c => {
        const val = String(row[c.k] ?? '');
        const truncated = val.length > Math.floor(c.w/2) ? val.slice(0, Math.floor(c.w/2))+'…' : val;
        doc.text(truncated, x+1, y+4);
        x += c.w;
      });
      y += 6;
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(128,128,128);
    doc.text('Prozorro Analytics Platform — безкоштовно для всіх', 14, 200);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="tenders_${Date.now()}.pdf"`);
    return reply.send(Buffer.from(doc.output('arraybuffer')));
  });
}
