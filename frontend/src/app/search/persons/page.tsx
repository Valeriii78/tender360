'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const ROLE_UA: Record<string,string> = {
  director:'Керівник', founder:'Засновник', beneficiary:'Бенефіціар',
  signatory:'Підписант', accountant:'Бухгалтер',
};

export default function SearchPersonsPage() {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const doSearch = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await api.searchPersons({ q, limit: 30 });
      setResults(data);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:24 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
          Пошук фізичних осіб
        </h1>
        <p style={{ fontSize:12, color:'var(--muted)' }}>
          Засновники, керівники, бенефіціари, підписанти та бухгалтери компаній
        </p>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <input value={q} onChange={e=>setQ(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&doSearch()}
          placeholder="Прізвище Ім'я По-батькові..."
          autoFocus
          style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:8, padding:'10px 14px', fontSize:13, color:'var(--text)' }}/>
        <button onClick={doSearch} style={{ background:'var(--accent)', color:'#fff',
          border:'none', borderRadius:8, padding:'10px 24px', fontSize:13,
          fontWeight:600, cursor:'pointer' }}>Знайти</button>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳ Шукаю...</div>}

      {!results && !loading && (
        <div style={{ padding:60, textAlign:'center', color:'var(--faint)' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>👤</div>
          <div style={{ fontSize:14 }}>Введіть ПІБ для пошуку</div>
          <div style={{ fontSize:12, marginTop:8, color:'var(--faint)' }}>
            Можна частково: «Сендецький» або «Іванов Іван»
          </div>
        </div>
      )}

      {results?.data?.length === 0 && (
        <div style={{ padding:40, textAlign:'center', color:'var(--faint)' }}>Нічого не знайдено</div>
      )}

      {results?.data?.map((p: any) => (
        <div key={p.id}
          onClick={()=>router.push(`/person/${p.id}`)}
          style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10,
            padding:16, marginBottom:10, cursor:'pointer', transition:'border-color .15s' }}
          onMouseOver={e=>(e.currentTarget.style.borderColor='var(--accent)')}
          onMouseOut={e=>(e.currentTarget.style.borderColor='var(--border)')}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--accent)', marginBottom:4 }}>
                {p.full_name}
              </div>
              {p.address && (
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>{p.address}</div>
              )}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {p.roles?.filter(Boolean).map((r: string) => (
                  <span key={r} style={{ fontSize:10, padding:'2px 8px', borderRadius:4,
                    background:'var(--tag-bg)', color:'var(--tag-text)', border:'1px solid var(--border)' }}>
                    {ROLE_UA[r] ?? r}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0, marginLeft:16 }}>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'monospace' }}>
                {p.companies_count}
              </div>
              <div style={{ fontSize:10, color:'var(--faint)' }}>компаній</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
