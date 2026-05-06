import 'dotenv/config';
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false });

// Судовий реєстр — відкрите API ВДРСР
const COURT_API = 'https://api.court.gov.ua/api/v1';

async function sleep(ms: number) { return new Promise(r=>setTimeout(r,ms)); }

async function searchByEdrpou(edrpou: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${COURT_API}/cases?search=${edrpou}&limit=20`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data ?? data?.cases ?? [];
  } catch { return []; }
}

async function saveCourtCase(edrpou: string, c: any): Promise<void> {
  // Знайти company_id
  const res = await db.query('SELECT id FROM companies WHERE edrpou=$1 LIMIT 1',[edrpou]);
  const companyId = res.rows[0]?.id ?? null;

  await db.query(`
    INSERT INTO court_cases (case_number,company_id,court_name,category,status,date_opened,description,source_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (case_number) DO UPDATE SET
      status=EXCLUDED.status, court_name=EXCLUDED.court_name
  `, [
    c.case_number ?? c.number ?? null,
    companyId,
    c.court_name ?? c.court ?? null,
    c.category ?? c.type ?? null,
    c.status ?? null,
    c.date_opened ?? c.date ?? null,
    c.description ?? c.subject ?? null,
    c.url ?? null,
  ]);
}

// Краулимо топ компаній по кількості тендерів
async function main() {
  console.log('\n⚖️  Courts Crawler v1.0\n');

  // Отримуємо список компаній для перевірки (топ учасники Prozorro)
  const companies = await db.query(`
    SELECT DISTINCT s.edrpou
    FROM suppliers s
    JOIN awards a ON a.supplier_id = s.id
    GROUP BY s.edrpou
    ORDER BY COUNT(a.id) DESC
    LIMIT 500
  `);

  console.log(`🔍 Перевіряю ${companies.rows.length} компаній...`);
  let total = 0;

  for (const { edrpou } of companies.rows) {
    const cases = await searchByEdrpou(edrpou);
    for (const c of cases) {
      await saveCourtCase(edrpou, c);
      total++;
    }
    await sleep(300); // не спамимо API
  }

  console.log(`✅ Збережено ${total} судових справ`);
  await db.end();
}

main().catch(e=>{ console.error(e); process.exit(1); });
