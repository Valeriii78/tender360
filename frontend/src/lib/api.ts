const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function req<T>(path: string, params?: Record<string,any>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) Object.entries(params).forEach(([k,v]) => v != null && url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  // Пошук
  searchCompanies:  (p: any) => req('/api/search/companies', p),
  searchPersons:    (p: any) => req('/api/search/persons', p),
  quickSearch:      (q: string) => req<any>('/api/search/quick', { q }),

  // Компанія
  getCompany:       (edrpou: string) => req<any>(`/api/company/${edrpou}`),
  getParticipant:   (edrpou: string, p?: any) => req<any>(`/api/company/${edrpou}/prozorro/participant`, p),
  getBuyer:         (edrpou: string, p?: any) => req<any>(`/api/company/${edrpou}/prozorro/buyer`, p),
  getCompetitors:   (edrpou: string) => req<any>(`/api/company/${edrpou}/competitors`),
  getGraph:         (edrpou: string) => req<any>(`/api/company/${edrpou}/graph`),
  getHistory:       (edrpou: string) => req<any>(`/api/company/${edrpou}/history`),

  // Особа
  getPerson:        (id: string) => req<any>(`/api/person/${id}`),

  // Тендери
  getTenders:       (p: any) => req<any>('/api/tenders', p),
  getTender:        (id: string) => req<any>(`/api/tenders/${id}`),

  // Аналітика
  getTopWinners:    (p?: any) => req<any[]>('/api/analytics/top-winners', p),
  getByRegion:      () => req<any[]>('/api/analytics/by-region'),
  getMonthly:       (p: any) => req<any[]>('/api/analytics/monthly', p),

  // Експорт
  exportUrl: (format: 'xlsx'|'csv'|'pdf', params: Record<string,any>) => {
    const url = new URL(`${BASE}/api/export/${format}`);
    Object.entries(params).forEach(([k,v]) => v != null && url.searchParams.set(k,String(v)));
    return url.toString();
  },
};
