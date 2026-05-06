'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ExportButton } from '@/components/Layout';

function SearchTendersInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [q,          setQ]          = useState(searchParams.get('q') ?? '');
  const [status,     setStatus]     = useState('');
  const [procMethod, setProcMethod] = useState('');
  const [amountMin,  setAmountMin]  = useState('');
  const [amountMax,  setAmountMax]  = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [results,    setResults]    = useState<any>(null);
  const [selected,   setSelected]   = useState<any>(null);
  const [loading,    setLoading]    = useState(false);
  const [page,       setPage]       = useState(0);
  const LIMIT = 20;

  const doSearch = async (p = 0) => {
    setLoading(true);
    try {
      const data = await api.getTenders({
        q: q || undefined, status: status || undefined,
        procMethod: procMethod || undefined,
        amountMin: amountMin || undefined, amountMax: amountMax || undefined,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
        limit: LIMIT, offset: p * LIMIT,
      });
      setResults(data);
      setPage(p);
      setSelected(null);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (searchParams.get('q')) doSearch(0);
  }, []);

  const fmt = (n: number) => n ? `${(n/1000).toFixed(0)} тис` : '—';

  return (
    <div style={{ display:'flex', height:'calc(100vh - 52px)', overflow:'hidden' }}>

      {/* Filters */}
      <div style={{ width:220, background:'var(--bg2)', borderRight:'1px solid var(--border)',
        padding:16, overflowY:'auto', flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', letterSpacing:.8, marginBottom:14 }}>ФІЛЬТРИ</div>

        {[
          { label:'Назва / ID тендера', val:q, set:setQ, ph:'Пошук...' },
          { label:'Від дати',  val:dateFrom, set:setDateFrom, type:'date' },
          { label:'До дати',   val:dateTo,   set:setDateTo,   type:'date' },
          { label:'Сума від (грн)', val:amountMin, set:setAmountMin, ph:'100000' },
          { label:'Сума до (грн)',  val:amountMax, set:setAmountMax, ph:'10000000' },
        ].map(f=>(
          <div key={f.label} style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:'var(--faint)', display:'block', marginBottom:3 }}>{f.label}</label>
            <input value={f.val} onChange={e=>f.set(e.target.value)}
              type={(f as any).type ?? 'text'}
              placeholder={(f as any).ph ?? ''}
              onKeyDown={e=>e.key==='Enter'&&doSearch(0)}
              style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
                borderRadius:6, padding:'6px 9px', fontSize:12, color:'var(--text)' }}/>
          </div>
        ))}

        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:11, color:'var(--faint)', display:'block', marginBottom:3 }}>Статус</label>
          <select value={status} onChange={e=>setStatus(e.target.value)}
            style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:6, padding:'6px 9px', fontSize:12, color:'var(--text)' }}>
            <option value="">Всі</option>
            <option value="active">Активний</option>
            <option value="complete">Завершено</option>
            <option value="cancelled">Скасовано</option>
            <option value="unsuccessful">Не відбувся</option>
          </select>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, color:'var(--faint)', display:'block', marginBottom:3 }}>Процедура</label>
          <select value={procMethod} onChange={e=>setProcMethod(e.target.value)}
            style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:6, padding:'6px 9px', fontSize:12, color:'var(--text)' }}>
            <option value="">Всі</option>
            <option value="open">Відкриті торги</option>
            <option value="reporting">Звіт про договір</option>
            <option value="negotiation">Переговорна процедура</option>
            <option value="priceQuotation">Запит ціни</option>
          </select>
        </div>

        <button onClick={()=>doSearch(0)} style={{ width:'100%', background:'var(--accent)',
          color:'#fff', border:'none', borderRadius:7, padding:'8px', fontSize:13,
          fontWeight:600, cursor:'pointer' }}>🔍 Знайти</button>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)',
          background:'var(--bg2)', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          {!loading && results && (
            <>
              <span style={{ fontSize:12, color:'var(--muted)' }}>
                Знайдено: <strong style={{ color:'var(--text)' }}>{results.total?.toLocaleString('uk-UA')}</strong>
              </span>
              <ExportButton params={{ q, status }} label="Експорт"/>
            </>
          )}
          {loading && <span style={{ fontSize:12, color:'var(--muted)' }}>⏳ Шукаю...</span>}
          {!results && !loading && (
            <span style={{ fontSize:12, color:'var(--faint)' }}>Використовуйте фільтри зліва для пошуку</span>
          )}
        </div>

        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          {/* Results table */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {results?.data?.length === 0 && (
              <div style={{ padding:40, textAlign:'center', color:'var(--faint)' }}>Нічого не знайдено</div>
            )}
            {results?.data && (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                  <tr style={{ background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                    {['Назва','Регіон','Статус','Уч.','Очікувана','Договір','Ек.%','Замовник','Переможець','Дата'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10,
                        color:'var(--faint)', fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.data.map((t: any) => (
                    <tr key={t.id}
                      onClick={()=>setSelected(selected?.id===t.id ? null : t)}
                      style={{ borderTop:'1px solid var(--border)', cursor:'pointer',
                        background: selected?.id===t.id ? 'var(--tag-bg)' : '' }}
                      onMouseOver={e=>{ if(selected?.id!==t.id) e.currentTarget.style.background='var(--bg3)'; }}
                      onMouseOut={e=>{ if(selected?.id!==t.id) e.currentTarget.style.background=''; }}>
                      <td style={{ padding:'9px 10px', maxWidth:200 }}>
                        <div style={{ fontSize:11, fontWeight:500, color:'var(--text)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                        <div style={{ fontSize:9, color:'var(--faint)', fontFamily:'monospace', marginTop:1 }}>{t.tender_id?.slice(0,20)}</div>
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' }}>
                        {t.buyer_name?.slice(0,15)}…
                      </td>
                      <td style={{ padding:'9px 10px' }}>
                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3,
                          background: t.status==='complete'?'rgba(16,185,129,.1)':
                            t.status==='active'?'rgba(14,165,233,.1)':'var(--bg3)',
                          color: t.status==='complete'?'var(--green)':
                            t.status==='active'?'var(--accent)':'var(--faint)' }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding:'9px 10px', textAlign:'center' }}>
                        <span style={{ fontSize:11, background:'var(--tag-bg)', color:'var(--tag-text)',
                          borderRadius:4, padding:'1px 5px', fontWeight:600 }}>{t.bids_count}</span>
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:11, fontFamily:'monospace',
                        color:'var(--text)', whiteSpace:'nowrap' }}>{fmt(t.amount)}</td>
                      <td style={{ padding:'9px 10px', fontSize:11, fontFamily:'monospace',
                        color:'var(--green)', whiteSpace:'nowrap' }}>{fmt(t.award_amount)}</td>
                      <td style={{ padding:'9px 10px', textAlign:'center', fontSize:11,
                        color: t.economy_pct>3 ? 'var(--green)' : 'var(--faint)' }}>
                        {t.economy_pct ? `${t.economy_pct}%` : '—'}
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:10, color:'var(--muted)', maxWidth:140 }}>
                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.buyer_name}</div>
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:10, color:'var(--accent)', maxWidth:140 }}>
                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.winner_name}</div>
                      </td>
                      <td style={{ padding:'9px 10px', fontSize:10, color:'var(--faint)', whiteSpace:'nowrap' }}>
                        {t.date_created?.slice(0,10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {results && (
              <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)',
                display:'flex', justifyContent:'space-between', background:'var(--bg2)' }}>
                <span style={{ fontSize:11, color:'var(--faint)' }}>
                  {page*LIMIT+1}–{Math.min((page+1)*LIMIT, results.total)} з {results.total?.toLocaleString()}
                </span>
                <div style={{ display:'flex', gap:8 }}>
                  <button disabled={page===0} onClick={()=>doSearch(page-1)}
                    style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)',
                      borderRadius:5, padding:'3px 10px', fontSize:11, cursor:'pointer',
                      opacity:page===0?.4:1 }}>←</button>
                  <button disabled={(page+1)*LIMIT>=results.total} onClick={()=>doSearch(page+1)}
                    style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)',
                      borderRadius:5, padding:'3px 10px', fontSize:11, cursor:'pointer',
                      opacity:(page+1)*LIMIT>=results.total?.4:1 }}>→</button>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          {selected && (
            <div style={{ width:340, borderLeft:'1px solid var(--border)', background:'var(--bg2)',
              overflowY:'auto', flexShrink:0 }}>
              <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)',
                display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, fontFamily:'monospace', color:'var(--accent)', marginBottom:4 }}>{selected.tender_id}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', lineHeight:1.4 }}>{selected.title}</div>
                </div>
                <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none',
                  color:'var(--faint)', fontSize:16, cursor:'pointer', padding:'0 0 0 8px' }}>×</button>
              </div>

              <div style={{ padding:14 }}>
                {/* Amounts */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  <div style={{ background:'var(--bg3)', borderRadius:7, padding:'10px 12px' }}>
                    <div style={{ fontSize:9, color:'var(--faint)', marginBottom:3 }}>ОЧІКУВАНА</div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', fontFamily:'monospace' }}>
                      {selected.amount?.toLocaleString('uk-UA')} ₴
                    </div>
                  </div>
                  {selected.award_amount && (
                    <div style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)',
                      borderRadius:7, padding:'10px 12px' }}>
                      <div style={{ fontSize:9, color:'var(--faint)', marginBottom:3 }}>ДОГОВІР</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--green)', fontFamily:'monospace' }}>
                        {selected.award_amount?.toLocaleString('uk-UA')} ₴
                      </div>
                      {selected.economy_pct && (
                        <div style={{ fontSize:10, color:'var(--green)', marginTop:2 }}>
                          Економія: {selected.economy_pct}%
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status + procedure */}
                <div style={{ background:'var(--bg3)', borderRadius:7, padding:'8px 12px',
                  marginBottom:14, fontSize:11, color:'var(--text)' }}>
                  <strong>{selected.procurement_method_type ?? 'Відкриті торги'}</strong>
                  <span style={{ marginLeft:8, color: selected.status==='complete'?'var(--green)':'var(--amber)' }}>
                    • {selected.status}
                  </span>
                </div>

                {/* Buyer */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--faint)',
                    letterSpacing:.8, marginBottom:8 }}>ЗАМОВНИК</div>
                  <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:4 }}>
                      {selected.buyer_name}
                    </div>
                    <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--accent)', marginBottom:6 }}>
                      #{selected.buyer_edrpou}
                    </div>
                    {selected.buyer_phone && (
                      <div style={{ fontSize:11, color:'var(--text)', marginBottom:2 }}>
                        📞 {selected.buyer_phone}
                      </div>
                    )}
                    {selected.buyer_email && (
                      <div style={{ fontSize:11, color:'var(--accent)' }}>
                        ✉️ {selected.buyer_email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Winner */}
                {selected.winner_name && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--faint)',
                      letterSpacing:.8, marginBottom:8 }}>ПЕРЕМОЖЕЦЬ</div>
                    <div style={{ border:'1px solid rgba(16,185,129,.3)',
                      background:'rgba(16,185,129,.06)', borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--green)' }}>
                        ✓ {selected.winner_name}
                      </div>
                      <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--faint)', marginTop:3 }}>
                        {selected.winner_edrpou}
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div style={{ fontSize:11, color:'var(--faint)' }}>
                  <div style={{ marginBottom:4 }}>📅 Створено: {selected.date_created?.slice(0,10)}</div>
                  <div>🔄 Оновлено: {selected.date_modified?.slice(0,10)}</div>
                </div>

                <a href={`/tender/${selected.id}`} style={{ display:'block', marginTop:14,
                  background:'var(--accent)', color:'#fff', textAlign:'center',
                  borderRadius:7, padding:'8px', fontSize:12, fontWeight:600, textDecoration:'none' }}>
                  Детальніше →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchTendersPage() {
  return (
    <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳ Завантаження...</div>}>
      <SearchTendersInner />
    </Suspense>
  );
}
