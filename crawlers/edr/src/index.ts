import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initEdrDatabase, getCrawlerState, setCrawlerState } from './db';
import { saveCompany } from './storage';
import {
  DUMP_SOURCES, getLatestDumpUrl, downloadFile,
  extractZip, streamParseXml,
} from './parser';

const BATCH_SIZE  = 500;   // зберігаємо пачками по N записів
const WORK_DIR    = path.join(os.tmpdir(), 'edr-dumps');
const RETRY_HOURS = 24;    // повторний sync через 24 год

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── ОБРОБКА ОДНОГО ДАМП-ФАЙЛУ ───────────────────────────────
async function processDumpFile(xmlPath: string, sourceName: string): Promise<void> {
  const sourceFile = path.basename(xmlPath);
  console.log(`\n📂 Обробляю: ${sourceFile}`);

  let saved = 0, skipped = 0, errors = 0;
  const batch: ReturnType<typeof streamParseXml> extends AsyncGenerator<infer T> ? T[] : never[] = [];

  const startTime = Date.now();

  for await (const record of streamParseXml(xmlPath, sourceFile)) {
    try {
      await saveCompany(record);
      saved++;
    } catch (err: any) {
      errors++;
      if (errors <= 5) {
        console.error(`  ❌ ${record.edrpou}: ${err.message?.slice(0, 80)}`);
      }
    }

    if (saved % 10_000 === 0 && saved > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(saved / elapsed);
      console.log(`  ✅ ${saved.toLocaleString()} збережено | ${rate}/сек | помилок: ${errors}`);
    }
  }

  console.log(`\n  📊 Підсумок ${sourceFile}:`);
  console.log(`     Збережено: ${saved.toLocaleString()}`);
  console.log(`     Помилок:   ${errors}`);
  console.log(`     Час:       ${((Date.now() - startTime) / 60000).toFixed(1)} хв`);
}

// ─── ЗАВАНТАЖЕННЯ ТА ОБРОБКА ОДНОГО ДЖЕРЕЛА ──────────────────
async function processDumpSource(source: typeof DUMP_SOURCES[0]): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🗂  ${source.description}`);
  console.log(`${'═'.repeat(60)}`);

  // Перевіряємо чи треба оновлювати
  const lastRun = await getCrawlerState(`edr_${source.name}_last_run`);
  if (lastRun) {
    const hoursSince = (Date.now() - new Date(lastRun).getTime()) / 3_600_000;
    if (hoursSince < RETRY_HOURS) {
      console.log(`⏭  Пропускаємо — оновлено ${hoursSince.toFixed(1)} год тому (мін. ${RETRY_HOURS} год)`);
      return;
    }
  }

  // Отримуємо URL останнього дампу
  console.log('🔍 Знаходжу URL дампу...');
  const dumpUrl = await getLatestDumpUrl(source.metaUrl);
  if (!dumpUrl) {
    console.error(`❌ Не вдалось отримати URL для ${source.name}`);
    return;
  }
  console.log(`✅ URL: ${dumpUrl.slice(0, 80)}…`);

  // Перевіряємо чи той самий файл вже завантажений
  const lastUrl = await getCrawlerState(`edr_${source.name}_last_url`);
  if (lastUrl === dumpUrl) {
    console.log('⏭  Той самий файл — пропускаємо');
    await setCrawlerState(`edr_${source.name}_last_run`, new Date().toISOString());
    return;
  }

  // Завантажуємо
  if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });
  const zipPath = path.join(WORK_DIR, `${source.name}.zip`);

  try {
    await downloadFile(dumpUrl, zipPath);
    const fileSizeMB = fs.statSync(zipPath).size / 1024 / 1024;
    console.log(`✅ Завантажено: ${fileSizeMB.toFixed(1)} MB`);
  } catch (err: any) {
    console.error(`❌ Помилка завантаження: ${err.message}`);
    return;
  }

  // Розпаковуємо
  console.log('📦 Розпаковую...');
  let xmlFiles: string[];
  try {
    xmlFiles = await extractZip(zipPath, WORK_DIR);
  } catch (err: any) {
    // Якщо це вже XML (не ZIP)
    if (dumpUrl.endsWith('.xml')) {
      xmlFiles = [zipPath.replace('.zip', '.xml')];
      fs.renameSync(zipPath, xmlFiles[0]);
    } else {
      console.error(`❌ Помилка розпакування: ${err.message}`);
      return;
    }
  }

  // Обробляємо кожен XML файл
  for (const xmlPath of xmlFiles) {
    await processDumpFile(xmlPath, source.name);
    // Видаляємо після обробки щоб зберегти диск
    try { fs.unlinkSync(xmlPath); } catch {}
  }

  // Видаляємо ZIP
  try { fs.unlinkSync(zipPath); } catch {}

  // Зберігаємо стан
  await setCrawlerState(`edr_${source.name}_last_url`, dumpUrl);
  await setCrawlerState(`edr_${source.name}_last_run`, new Date().toISOString());

  console.log(`\n✅ ${source.description} — оновлено`);
}

// ─── ІНКРЕМЕНТАЛЬНИЙ SYNC (real-time через USR МінЮсту) ───────
// МінЮст надає API для перевірки по ЄДРПОУ
async function checkCompanyRealtime(edrpou: string): Promise<void> {
  const url = `https://usr.minjust.gov.ua/api/1.0/subjects/${edrpou}`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;

    const data = await res.json();
    // Парсинг відповіді МінЮсту...
    // (структура відрізняється від XML-дампу, обробка окремо)
    console.log(`  🔄 Real-time оновлення: ${edrpou}`);
  } catch {
    // Ігноруємо — не критично для краулера
  }
}

// ─── ОСНОВНИЙ ЦИКЛ ────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n🇺🇦 ЄДР Crawler v1.0');
  console.log('═'.repeat(60));

  // Ініціалізація БД
  await initEdrDatabase();

  // Режим роботи
  const mode = process.env.EDR_MODE ?? 'full';

  if (mode === 'full' || mode === 'dump') {
    console.log('\n📥 Режим: повне завантаження з data.gov.ua\n');

    for (const source of DUMP_SOURCES) {
      try {
        await processDumpSource(source);
      } catch (err: any) {
        console.error(`❌ Критична помилка для ${source.name}: ${err.message}`);
      }
      await sleep(2000); // пауза між джерелами
    }

    console.log('\n✅ Всі джерела оброблено');
  }

  if (mode === 'watch') {
    // Режим постійного оновлення — раз на добу
    console.log('\n⏱  Режим: постійне оновлення (щодня)\n');

    const run = async () => {
      for (const source of DUMP_SOURCES) {
        try { await processDumpSource(source); } catch {}
      }
    };

    await run();
    setInterval(run, 24 * 60 * 60 * 1000);
  }

  if (mode === 'check') {
    // Перевірка конкретного ЄДРПОУ
    const edrpou = process.argv[3];
    if (!edrpou) { console.error('Вкажіть ЄДРПОУ: EDR_MODE=check node dist/index.js 12345678'); process.exit(1); }
    await checkCompanyRealtime(edrpou);
  }
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
