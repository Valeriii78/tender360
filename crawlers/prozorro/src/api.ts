import { TenderListResponse, TenderResponse } from './types';

const BASE_URL = 'https://public-api.prozorro.gov.ua/api/2.5';
const RETRY_DELAYS = [1000, 3000, 10000]; // ms между попытками

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(url: string, attempt = 0): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    // Rate limit — ждём и повторяем
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5') * 1000;
      console.warn(`⚠️  Rate limit. Ждём ${retryAfter / 1000}s...`);
      await sleep(retryAfter);
      return fetchWithRetry<T>(url, attempt);
    }

    // 404 — тендер удалён, не ошибка
    if (res.status === 404) {
      throw new Error('NOT_FOUND');
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (err: any) {
    // NOT_FOUND не ретраим
    if (err.message === 'NOT_FOUND') throw err;

    if (attempt < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt];
      console.warn(`⚠️  Ошибка ${err.message}. Retry ${attempt + 1} через ${delay / 1000}s...`);
      await sleep(delay);
      return fetchWithRetry<T>(url, attempt + 1);
    }

    throw err;
  }
}

// Получить страницу списка тендеров
export async function fetchTenderList(offset?: string): Promise<TenderListResponse> {
  const params = new URLSearchParams({ limit: '100' });
  if (offset) params.set('offset', offset);
  const url = `${BASE_URL}/tenders?${params}`;
  return fetchWithRetry<TenderListResponse>(url);
}

// Получить полные данные одного тендера
export async function fetchTender(id: string): Promise<TenderResponse | null> {
  try {
    return await fetchWithRetry<TenderResponse>(`${BASE_URL}/tenders/${id}`);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return null;
    throw err;
  }
}
