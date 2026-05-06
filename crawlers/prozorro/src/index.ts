import 'dotenv/config';
import { initDatabase, getCrawlerState, setCrawlerState } from './db';
import { fetchTenderList, fetchTender } from './api';
import { saveTender } from './storage';

const CONCURRENCY     = 5;   // параллельных запросов за деталями тендера
const DELAY_BETWEEN   = 200; // ms между batch запросами (не спамим API)

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Обработать один тендер
async function processTender(id: string): Promise<boolean> {
  try {
    const res = await fetchTender(id);
    if (!res) return false; // 404, пропускаем
    await saveTender(res.data);
    return true;
  } catch (err: any) {
    console.error(`  ❌ Ошибка тендера ${id}: ${err.message}`);
    return false;
  }
}

// Обработать массив ID параллельно (пачками по CONCURRENCY)
async function processBatch(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(id => processTender(id)));
    if (i + CONCURRENCY < ids.length) await sleep(DELAY_BETWEEN);
  }
}

// Полный sync: качаем всё от начала до конца
async function fullSync(): Promise<void> {
  console.log('\n🚀 ПОЛНЫЙ SYNC — начинаем...\n');

  let offset   = await getCrawlerState('full_sync_offset') ?? undefined;
  let page     = 1;
  let total    = 0;
  let errors   = 0;

  if (offset) {
    console.log(`↪️  Resuming с offset: ${offset}\n`);
  }

  while (true) {
    // Получаем страницу списка
    const list = await fetchTenderList(offset);
    const ids  = list.data.map(t => t.id);

    if (ids.length === 0) {
      console.log('\n✅ Полный sync завершён!');
      await setCrawlerState('full_sync_done', 'true');
      await setCrawlerState('full_sync_offset', '');
      break;
    }

    console.log(`📄 Страница ${page} | ${ids.length} тендеров | всего: ${total + ids.length}`);

    await processBatch(ids);

    total  += ids.length;
    errors += ids.length - ids.length; // считается в processTender
    offset  = list.next_page?.offset;
    page++;

    // Сохраняем прогресс — если упадём, продолжим с этого места
    if (offset) {
      await setCrawlerState('full_sync_offset', offset);
    }

    // Небольшая пауза между страницами
    await sleep(300);
  }

  console.log(`\n📊 Итого обработано: ${total} тендеров`);
}

// Инкрементальный sync: только изменённые за последние N минут
async function incrementalSync(): Promise<void> {
  const lastOffset = await getCrawlerState('incremental_offset');

  if (!lastOffset) {
    // Первый инкрементальный запуск — берём последние 5 минут
    const fiveMinAgo = Date.now() / 1000 - 300;
    await setCrawlerState('incremental_offset', String(fiveMinAgo));
  }

  const offset = await getCrawlerState('incremental_offset') ?? undefined;
  console.log(`\n🔄 Инкрементальный sync (offset: ${offset})...`);

  let newOffset = offset;
  let total     = 0;
  let page      = 1;

  while (true) {
    const list = await fetchTenderList(newOffset);
    const ids  = list.data.map(t => t.id);

    if (ids.length === 0) break;

    console.log(`  Страница ${page}: ${ids.length} обновлений`);
    await processBatch(ids);

    total    += ids.length;
    newOffset = list.next_page?.offset;
    page++;

    await sleep(200);

    // Если получили меньше 100 — это последняя страница
    if (ids.length < 100) break;
  }

  if (newOffset) {
    await setCrawlerState('incremental_offset', newOffset);
  }

  if (total > 0) {
    console.log(`  ✅ Синхронизировано: ${total} тендеров`);
  } else {
    console.log(`  ✅ Новых изменений нет`);
  }
}

// Запускаем инкрементальный sync по расписанию
function startIncrementalLoop(intervalMs: number): void {
  console.log(`\n⏱  Инкрементальный режим: каждые ${intervalMs / 1000 / 60} мин\n`);

  const run = async () => {
    try {
      await incrementalSync();
    } catch (err: any) {
      console.error(`❌ Ошибка инкрементального sync: ${err.message}`);
    }
    setTimeout(run, intervalMs);
  };

  setTimeout(run, intervalMs);
}

// ТОЧКА ВХОДА
async function main(): Promise<void> {
  console.log('🇺🇦 Prozorro Crawler v1.0\n');

  // Инициализация БД
  await initDatabase();

  // Проверяем — полный sync уже делали?
  const fullSyncDone = await getCrawlerState('full_sync_done');

  if (!fullSyncDone) {
    // Первый запуск — полный sync
    await fullSync();
  } else {
    console.log('✅ Полный sync уже выполнен ранее');
  }

  // Запускаем инкрементальный режим (каждые 5 минут)
  startIncrementalLoop(5 * 60 * 1000);

  // Первый инкрементальный запуск сразу
  await incrementalSync();
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
