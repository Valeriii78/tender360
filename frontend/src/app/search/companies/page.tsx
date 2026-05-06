'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ExportButton } from '@/components/Layout';

const REGIONS = [
  '', 'м. Київ', 'Вінницька', 'Волинська', 'Дніпропетровська',
  'Донецька', 'Житомирська', 'Закарпатська', 'Запорізька',
  'Івано-Франківська', 'Київська', 'Кіровоградська', 'Луганська',
  'Львівська', 'Миколаївська', 'Одеська', 'Полтавська',
  'Рівненська', 'Сумська', 'Тернопільська', 'Харківська',
  'Херсонська', 'Хмельницька', 'Черкаська', 'Чернівецька',
  'Чернігівська',
];

function SearchCompaniesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [q,       setQ]       = useState(searchParams.get('q') ?? '');
  const [region,  setRegion]  = useState('');
  const [status,  setStatus]  = useState('зареєстровано');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(0);
  const LIMIT = 25;

  const doSearch = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const data = await api.searchCompanies({
        q: q || undefined, region: region || undefined,
        status: status || undefined, limit: LIMIT, offset: p * LIMIT,
      });
      setResults(data);
      setPage(p);
    } finally { setLoading(false); }
  }, [q, region, status]);

  useEffect(() => {
    if (searchParams.get('q')) doSearch(0);
  }, []);

  return (
    <div style={{ display:'flex', height:'calc(100vh - 52px)', overflow:'hidden' }}>
      <div style={{ width:220, background:'var(--bg2)', borderRight:'1px solid var(--border)',
        padding:16, overflowY:'auto', flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', letterSpacing:.8, marginBottom:14 }}>ФІЛЬТРИ</div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:'var(--faint)', display:'block', marginBottom:4 }}>Пошуковий запит</label>
          <input value={q} onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doSearch(0)}
            placeholder="Назва або ЄДРПОУ..."
            style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:6, padding:'7px 10px', fontSize:12, color:'var(--text)' }}/>
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:'var(--faint)', display:'block', marginBottom:4 }}>Регіон</label>
          <select value={region} onChange={e=>setRegion(e.target.value)}
            style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:6, padding:'7px 10px', fontSize:12, color:'var(--text)', cursor:'pointer' }}>
            <option value="">Всі регіони</option>
            {REGIONS.filter(Boolean).map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:'var(--faint)', display:'block', marginBottom:4 }}>Статус</label>
          {['', 'зареєстровано', 'припинено', 'в стані припинення'].map(s=>(
            <label key={s} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, cursor:'pointer' }}>
              <input type="radio" checked={status===s} onChange={()=>setStatus(s)}/>
              <span style={{ fontSize:12, color:'var(--text)' }}>{s||'Всі'}</span>
            </label>
          ))}
        </div>
        <button onClick={()=>doSearch(0)} style={{
          width:'100%', background:'var(--accent)', color:'#fff', border:'none',
          borderRadius:7, padding:'8px', fontSize:13, fontWeight:600, cursor:'pointer',
        }}>🔍 Знайти</button>
        {results && (
          <button onClick={()=>{ setQ(''); setRegion(''); setStatus('зареєстровано'); setResults(null); }}
            style={{ width:'100%', background:'none', border:'1px solid var(--border)', color:'var(--muted)',
              borderRadius:7, padding:'7px', fontSize:12, cursor:'pointer', marginTop:8 }}>
            Очистити
          </button>
        )}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        {!results && !loading && (
          <div style={{ padding:60, textAlign:'center', color:'var(--faint)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🏢</div>
            <div style={{ fontSize:14 }}>Введіть назву або ЄДРПОУ компанії для пошуку</div>
          </div>
        )}
        {loading && <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳ Шукаю...</div>}
        {results && !loading && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ fontSize:13, color:'var(--muted)' }}>
                Знайдено: <strong style={{ color:'var(--text)' }}>{results.total?.toLocaleString('uk-UA')}</strong> компаній
              </span>
              <ExportButton params={{ q, region, status }} label="Експорт"/>
            </div>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                    {['ЄДРПОУ','Назва','Регіон','Статус','КВЕД','Prozorro','Санкції'].map(h=>(
                      <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11,
                        color:'var(--faint)', fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.data?.map((c: any) => (
                    <tr key={c.edrpou}
                      style={{ borderTop:'1px solid var(--border)', cursor:'pointer' }}
                      onMouseOver={e=>(e.currentTarget.style.background='var(--bg3)')}
                      onMouseOut={e=>(e.currentTarget.style.background='')}
                      onClick={()=>router.push(`/company/${c.edrpou}`)}>
                      <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:12, color:'var(--accent)', whiteSpace:'nowrap' }}>{c.edrpou}</td>
                      <td style={{ padding:'10px 12px', maxWidth:280 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.short_name || c.name}</div>
                        {c.short_name && <div style={{ fontSize:10, color:'var(--faint)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>}
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>{c.region ?? '—'}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, fontWeight:600,
                          background: c.status==='зареєстровано' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                          color: c.status==='зареєстровано' ? 'var(--green)' : 'var(--red)' }}>{c.status}</span>
                      </td>
                      <td style={{ padding:'10px 12px', fontSize:10, color:'var(--faint)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.primary_kved && `${c.primary_kved} ${c.primary_kved_name?.slice(0,30)}`}
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        {c.is_supplier && <span title="Учасник тендерів" style={{ fontSize:14 }}>📋</span>}
                        {c.is_buyer && <span title="Замовник тендерів" style={{ fontSize:14 }}>🏛️</span>}
                      </td>
                      <td style={{ padding:'10px 12px', textAlign:'center' }}>
                        {c.has_sanctions ? <span style={{ fontSize:11, color:'var(--red)', fontWeight:700 }}>🚫 Так</span> : <span style={{ fontSize:11, color:'var(--faint)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--faint)' }}>Сторінка {page+1} з {Math.ceil((results.total||0)/LIMIT)}</span>
                <div style={{ display:'flex', gap:8 }}>
                  <button disabled={page===0} onClick={()=>doSearch(page-1)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:5, padding:'4px 12px', fontSize:12, cursor:'pointer', opacity: page===0 ? .4 : 1 }}>← Назад</button>
                  <button disabled={(page+1)*LIMIT>=results.total} onClick={()=>doSearch(page+1)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:5, padding:'4px 12px', fontSize:12, cursor:'pointer', opacity: (page+1)*LIMIT>=results.total ? .4 : 1 }}>Далі →</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchCompaniesPage() {
  return (
    <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳ Завантаження...</div>}>
      <SearchCompaniesInner />
    </Suspense>
  );
}
