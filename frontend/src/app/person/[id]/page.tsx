'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

const ROLE_UA: Record<string,string> = {
  director:'Керівник', founder:'Засновник', beneficiary:'Бенефіціар',
  signatory:'Підписант', accountant:'Бухгалтер', liquidator:'Ліквідатор',
};
const STATUS_COLOR = (s: string) =>
  s==='зареєстровано' ? 'var(--green)' : 'var(--red)';

export default function PersonPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPerson(id)
      .then(setData)
      .catch(()=>setData(null))
      .finally(()=>setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳ Завантаження...</div>;
  if (!data) return <div style={{ padding:40, textAlign:'center', color:'var(--red)' }}>Особу не знайдено</div>;

  const { person, companies } = data;

  // Групуємо компанії по ролях
  const byRole: Record<string, any[]> = {};
  companies?.forEach((c: any) => {
    if (!byRole[c.role]) byRole[c.role] = [];
    byRole[c.role].push(c);
  });

  return (
    <div style={{ maxWidth:960, margin:'0 auto', padding:24 }}>
      {/* Header */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12,
        padding:20, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
              👤 {person.full_name}
            </div>
            {person.address && (
              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>
                📍 {person.address}
              </div>
            )}
            <div style={{ fontSize:11, color:'var(--faint)' }}>
              Пов'язана з <strong style={{ color:'var(--accent)' }}>{companies?.length ?? 0}</strong> компаніями
            </div>
          </div>

          {/* Role badges */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', maxWidth:280, justifyContent:'flex-end' }}>
            {Object.keys(byRole).map(role => (
              <span key={role} style={{ fontSize:11, padding:'4px 10px', borderRadius:20,
                background:'var(--tag-bg)', color:'var(--tag-text)',
                border:'1px solid var(--border)', fontWeight:500 }}>
                {ROLE_UA[role] ?? role} ({byRole[role].length})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Companies */}
      {Object.entries(byRole).map(([role, cos]) => (
        <div key={role} style={{ marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10,
            display:'flex', alignItems:'center', gap:8 }}>
            <span>{ROLE_UA[role] ?? role}</span>
            <span style={{ fontSize:11, color:'var(--faint)', fontWeight:400 }}>
              ({cos.length} {cos.length===1?'компанія':'компаній'})
            </span>
          </div>

          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg3)' }}>
                  {['ЄДРПОУ','Назва','Статус','Регіон',
                    role==='founder'||role==='beneficiary'?'Частка':'',
                    'Актуально'].filter(Boolean).map(h=>(
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left',
                      fontSize:10, color:'var(--faint)', fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cos.map((c: any, i: number) => (
                  <tr key={i} style={{ borderTop:'1px solid var(--border)', cursor:'pointer' }}
                    onMouseOver={e=>(e.currentTarget.style.background='var(--bg3)')}
                    onMouseOut={e=>(e.currentTarget.style.background='')}
                    onClick={()=>window.location.href=`/company/${c.edrpou}`}>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace',
                      fontSize:11, color:'var(--accent)' }}>{c.edrpou}</td>
                    <td style={{ padding:'10px 12px', maxWidth:280 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.name}
                      </div>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                        background: c.status==='зареєстровано'?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)',
                        color: STATUS_COLOR(c.status) }}>{c.status}</span>
                    </td>
                    <td style={{ padding:'10px 12px', fontSize:11, color:'var(--muted)' }}>
                      {c.region ?? '—'}
                    </td>
                    {(role==='founder'||role==='beneficiary') && (
                      <td style={{ padding:'10px 12px', fontSize:11, fontFamily:'monospace',
                        color:'var(--amber)' }}>
                        {c.share_pct ? `${c.share_pct}%` : c.share_amount ? `${c.share_amount?.toLocaleString()} грн` : '—'}
                      </td>
                    )}
                    <td style={{ padding:'10px 12px', fontSize:11 }}>
                      {c.is_active
                        ? <span style={{ color:'var(--green)' }}>✅ Так</span>
                        : <span style={{ color:'var(--faint)' }}>⬜ Ні</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {companies?.length === 0 && (
        <div style={{ padding:40, textAlign:'center', color:'var(--faint)', fontSize:13 }}>
          Зв'язків з компаніями не знайдено
        </div>
      )}
    </div>
  );
}
