import 'dotenv/config';
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false });

// Джерела санкцій
const SOURCES = [
  {
    name: 'rnbo',
    url: 'https://sanctions.nsdc.gov.ua/api/sanctions/',
    description: 'РНБО України',
  },
  {
    name: 'eu_ua',
    url: 'https://data.gov.ua/api/3/action/datastore_search?resource_id=75c58f17-ea29-4b42-9f77-4c7e895e699c&limit=5000',
    description: 'ЄС санкції (data.gov.ua)',
  },
];

async function sleep(ms: number) { return new Promise(r=>setTimeout(r,ms)); }

async function fetchWithRetry(url: string, attempt=0): Promise<any> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch(err: any) {
    if (attempt<3) { await sleep(3000*(attempt+1)); return fetchWithRetry(url,attempt+1); }
    throw err;
  }
}

async function saveSanction(s: {
  entity_type: string; entity_name: string; edrpou?: string;
  reason?: string; date_added?: string; date_expires?: string; source: string;
}) {
  await db.query(`
    INSERT INTO sanctions (entity_type,entity_name,edrpou,reason,date_added,date_expires,source,is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
    ON CONFLICT DO NOTHING
  `, [s.entity_type,s.entity_name,s.edrpou??null,s.reason??null,
      s.date_added??null,s.date_expires??null,s.source]);
}

async function crawlRnbo() {
  console.log('📋 РНБО санкції...');
  try {
    const data = await fetchWithRetry(SOURCES[0].url);
    const items: any[] = data?.data ?? data?.results ?? [];
    let count = 0;
    for (const item of items) {
      await saveSanction({
        entity_type: item.type==='physical'?'person':'company',
        entity_name: item.name_uk ?? item.name_en ?? item.name ?? '',
        edrpou: item.edrpou ?? item.registration_number ?? undefined,
        reason: item.reason ?? item.sanctions_basis ?? undefined,
        date_added: item.date_start ?? item.created_at ?? undefined,
        date_expires: item.date_end ?? undefined,
        source: 'РНБО',
      });
      count++;
    }
    console.log(`  ✅ РНБО: ${count} санкцій збережено`);
  } catch(e: any) {
    console.error(`  ❌ РНБО: ${e.message}`);
  }
}

async function crawlEuSanctions() {
  console.log('📋 ЄС санкції...');
  try {
    const data = await fetchWithRetry(SOURCES[1].url);
    const items: any[] = data?.result?.records ?? [];
    let count = 0;
    for (const item of items) {
      await saveSanction({
        entity_type: 'company',
        entity_name: item['Назва'] ?? item['Name'] ?? '',
        edrpou: item['ЄДРПОУ'] ?? undefined,
        reason: item['Підстава'] ?? undefined,
        date_added: item['Дата включення'] ?? undefined,
        source: 'ЄС',
      });
      count++;
    }
    console.log(`  ✅ ЄС: ${count} санкцій збережено`);
  } catch(e: any) {
    console.error(`  ❌ ЄС: ${e.message}`);
  }
}

async function main() {
  console.log('\n🚫 Sanctions Crawler v1.0\n');
  await crawlRnbo();
  await crawlEuSanctions();
  console.log('\n✅ Готово');
  await db.end();
}

main().catch(e=>{ console.error(e); process.exit(1); });
