'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ExportButton } from '@/components/Layout';

const ROLE_UA: Record<string,string> = {
  director:'Керівник', founder:'Засновник', beneficiary:'Бенефіціар',
  signatory:'Підписант', accountant:'Бухгалтер', liquidator:'Ліквідатор',
};
const ROLE_COLOR: Record<string,string> = {
  director:'var(--purple)', founder:'var(--accent)', beneficiary:'var(--amber)',
  signatory:'var(--green)', accountant:'var(--muted)', liquidator:'var(--red)',
};

function Section({ title, children, defaultOpen=true }: any) {
  const [open,setOpen]=useState(defaultOpen);
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:'100%', background:'none', border:'none', cursor:'pointer',
        padding:'12px 16px', display:'flex', justifyContent:'space-between',
        alignItems:'center', color:'var(--text)',
      }}>
        <span style={{ fontSize:13, fontWeight:600 }}>{title}</span>
        <span style={{ fontSize:10, color:'var(--faint)' }}>{open?'▲':'▼'}</span>
      </button>
      {open && <div style={{ padding:'0 16px 16px', borderTop:'1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: any }) {
  if (!v) return null;
  return (
    <div style={{ display:'flex', gap:8, marginBottom:8, fontSize:13 }}>
      <span style={{ color:'var(--faint)', minWidth:140, flexShrink:0 }}>{k}:</span>
      <span style={{ color:'var(--text)' }}>{v}</span>
    </div>
  );
}

export default function CompanyPage() {
  const { edrpou } = useParams() as { edrpou: string };
  const [data, setData]       = useState<any>(null);
  const [prozorro, setProzorro] = useState<any>(null);
  const [section, setSection] = useState('info');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getCompany(edrpou),
      api.getParticipant(edrpou, { limit:50 }),
    ]).then(([d, p]) => { setData(d); setProzorro(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [edrpou]);

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳ Завантаження...</div>;
  if (!data) return <div style={{ padding:40, textAlign:'center', color:'var(--red)' }}>Компанію не знайдено</div>;

  const { company, kveds, persons, sanctions, courts, related } = data;

  const MENU = [
    { id:'info',        label:'📋 Інформація' },
    { id:'participant', label:'🏆 Учасник Prozorro' },
    { id:'buyer',       label:'🏛️ Замовник' },
    { id:'persons',     label:`👤 Пов'язані (${persons?.length??0})` },
    { id:'graph',       label:'🔗 Граф зв\'язків' },
    { id:'history',     label:'🕐 Історія змін' },
    { id:'courts',      label:`⚖️ Суди (${courts?.length??0})` },
    { id:'sanctions',   label:`🚫 Санкції${sanctions?.length?` (${sanctions.length})`:''}` },
  ];

  return (
    <div style={{ display:'flex', height:'calc(100vh - 52px)', overflow:'hidden' }}>

      {/* Left sidebar */}
      <div style={{ width:220, background:'var(--bg2)', borderRight:'1px solid var(--border)',
        overflowY:'auto', flexShrink:0, padding:10 }}>
        {/* Company mini-card */}
        <div style={{ padding:'10px 8px', marginBottom:8, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <div style={{ width:8, height:8, borderRadius:'50%',
              background:company.status==='зареєстровано'?'var(--green)':'var(--red)',
              boxShadow:`0 0 5px ${company.status==='зареєстровано'?'var(--green)':'var(--red)'}` }}/>
            <span style={{ fontSize:10, color:company.status==='зареєстровано'?'var(--green)':'var(--red)', fontWeight:700 }}>
              {company.status?.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', lineHeight:1.4, marginBottom:2 }}>
            {company.short_name ?? company.name?.slice(0,40)}
          </div>
          <div style={{ fontSize:10, color:'var(--faint)', fontFamily:'monospace' }}>
            {company.edrpou}
          </div>
        </div>

        {MENU.map(m=>(
          <button key={m.id} onClick={()=>setSection(m.id)} style={{
            display:'block', width:'100%', textAlign:'left',
            background: section===m.id ? 'var(--tag-bg)' : 'none',
            color: section===m.id ? 'var(--tag-text)' : 'var(--muted)',
            border:'none', cursor:'pointer', padding:'7px 10px',
            borderRadius:6, fontSize:12, fontWeight: section===m.id ? 600 : 400,
            marginBottom:2,
          }}>{m.label}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>

        {/* Header */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12,
          padding:18, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{company.name}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>ЄДРПОУ: {company.edrpou} · {company.region} · {company.registration_date}</div>
            {company.has_sanctions && (
              <div style={{ marginTop:6, fontSize:11, color:'var(--red)', fontWeight:600 }}>🚫 Знаходиться під санкціями</div>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <ExportButton params={{ edrpou, role:'supplier' }} label="Тендери"/>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:16 }}>
          {[
            { icon:'📊', label:'Учасник', val:company.bids_count??0, color:'var(--accent)' },
            { icon:'🏆', label:'Переможець', val:company.wins_count??0, color:'var(--green)' },
            { icon:'💰', label:'Сума перемог', val: company.wins_amount>0 ? `${(company.wins_amount/1e6).toFixed(1)}M ₴` : '—', color:'var(--amber)' },
            { icon:'⚖️', label:'Судових справ', val:company.court_cases_count??0, color:'var(--purple)' },
          ].map(k=>(
            <div key={k.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
              <div style={{ fontSize:16, marginBottom:6 }}>{k.icon}</div>
              <div style={{ fontSize:20, fontWeight:700, color:k.color, fontFamily:'monospace', lineHeight:1 }}>{k.val}</div>
              <div style={{ fontSize:11, color:'var(--faint)', marginTop:4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── ІНФОРМАЦІЯ ── */}
        {section==='info' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <Section title="Основна інформація">
                <KV k="ЄДРПОУ"              v={<span style={{fontFamily:'monospace',fontWeight:700}}>{company.edrpou}</span>}/>
                <KV k="Назва"               v={company.name}/>
                <KV k="Скор. назва"         v={company.short_name}/>
                <KV k="Орг. форма"          v={company.legal_form}/>
                <KV k="Стан"                v={company.status}/>
                <KV k="Адреса"              v={company.address}/>
                <KV k="Дата реєстрації"     v={company.registration_date}/>
                <KV k="Номер запису"        v={company.registration_num}/>
                <KV k="Телефон"             v={company.phone}/>
                <KV k="Email"               v={company.email}/>
                <KV k="Статутний капітал"   v={company.capital ? `${company.capital.toLocaleString('uk-UA')} грн` : null}/>
              </Section>

              <Section title={`КВЕДи (${kveds?.length??0})`} defaultOpen={false}>
                {kveds?.map((k:any)=>(
                  <div key={k.kved_code} style={{ display:'flex', gap:8, marginBottom:8, fontSize:12 }}>
                    <span style={{ fontFamily:'monospace', color:'var(--accent)', minWidth:50 }}>{k.kved_code}</span>
                    <span style={{ color:'var(--text2)', flex:1 }}>{k.kved_name}</span>
                    {k.is_primary && <span style={{ fontSize:10, color:'var(--green)', fontWeight:700 }}>ОСНОВНИЙ</span>}
                  </div>
                ))}
              </Section>
            </div>

            <div>
              <Section title="Автоматичні перевірки">
                {[
                  [!company.has_sanctions, 'Не знаходиться під санкціями'],
                  [true, 'ЄДРПОУ активний в реєстрі'],
                  [company.status==='зареєстровано', 'Компанія зареєстрована'],
                  [!(company.tax_debt), 'Відсутній податковий борг'],
                  [(company.court_cases_count??0)===0, 'Немає судових справ'],
                ].map(([ok,label],i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8,
                    padding:'7px 10px', borderRadius:6,
                    background:ok?'rgba(16,185,129,.08)':'rgba(239,68,68,.08)' }}>
                    <span>{ok?'✅':'❌'}</span>
                    <span style={{ fontSize:12, color:ok?'var(--green)':'var(--red)' }}>{label}</span>
                  </div>
                ))}
              </Section>

              <Section title={`Засновники та керівники (${persons?.length??0})`}>
                {persons?.slice(0,8).map((p:any,i:number)=>(
                  <div key={i} style={{ marginBottom:10, padding:'8px 10px', background:'var(--bg3)', borderRadius:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <a href={`/person/${p.id}`} style={{ fontSize:12, fontWeight:500, color:'var(--accent)' }}>
                        {p.full_name}
                      </a>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
                        background:'var(--bg2)', color: ROLE_COLOR[p.role]??'var(--muted)',
                        border:`1px solid ${ROLE_COLOR[p.role]??'var(--border)'}44`,
                        whiteSpace:'nowrap', flexShrink:0 }}>
                        {ROLE_UA[p.role]??p.role}
                      </span>
                    </div>
                    {p.share_pct && <div style={{ fontSize:10, color:'var(--faint)', marginTop:3 }}>Частка: {p.share_pct}%</div>}
                    {p.address && <div style={{ fontSize:10, color:'var(--faint)', marginTop:2 }}>{p.address?.slice(0,60)}</div>}
                  </div>
                ))}
              </Section>
            </div>
          </div>
        )}

        {/* ── УЧАСНИК ── */}
        {section==='participant' && prozorro && (
          <div>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
              {[
                { l:'Всього участей',  v:prozorro.stats?.total_bids,   c:'var(--accent)' },
                { l:'Перемог',         v:prozorro.stats?.total_wins,   c:'var(--green)' },
                { l:'Сума перемог',    v:prozorro.stats?.wins_amount>0?`${(prozorro.stats.wins_amount/1e6).toFixed(1)}M ₴`:'—', c:'var(--amber)' },
                { l:'Перша ставка',    v:prozorro.stats?.first_bid?.slice(0,10), c:'var(--faint)' },
              ].map(k=>(
                <div key={k.l} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:k.c, fontFamily:'monospace' }}>{k.v??'—'}</div>
                  <div style={{ fontSize:11, color:'var(--faint)', marginTop:4 }}>{k.l}</div>
                </div>
              ))}
            </div>

            {/* Tender table */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>Участі в тендерах</span>
                <ExportButton params={{ edrpou, role:'supplier' }}/>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
                  <thead>
                    <tr style={{ background:'var(--bg3)' }}>
                      {['ID','Назва','Статус','Очікувана','Договір','Ек.%','Результат','Замовник','Дата'].map(h=>(
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11,
                          color:'var(--faint)', fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prozorro.data?.map((t:any)=>(
                      <tr key={t.id} style={{ borderTop:'1px solid var(--border)', cursor:'pointer' }}
                        onClick={()=>window.open(`/tender/${t.id}`,'_blank')}>
                        <td style={{ padding:'9px 12px', fontSize:10, fontFamily:'monospace', color:'var(--accent)' }}>{t.tender_id?.slice(0,18)}…</td>
                        <td style={{ padding:'9px 12px', fontSize:11, maxWidth:200 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>{t.title}</div>
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                            background:t.tender_status==='complete'?'rgba(16,185,129,.1)':'var(--bg3)',
                            color:t.tender_status==='complete'?'var(--green)':'var(--muted)' }}>
                            {t.tender_status}
                          </span>
                        </td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', color:'var(--text)', whiteSpace:'nowrap' }}>
                          {t.expected_amount ? `${(t.expected_amount/1000).toFixed(0)} тис` : '—'}
                        </td>
                        <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'monospace', color:'var(--green)', whiteSpace:'nowrap' }}>
                          {t.award_amount ? `${(t.award_amount/1000).toFixed(0)} тис` : '—'}
                        </td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:t.economy_pct>3?'var(--green)':'var(--faint)', textAlign:'center' }}>
                          {t.economy_pct ? `${t.economy_pct}%` : '—'}
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10,
                            background:t.is_winner?'rgba(16,185,129,.1)':'rgba(148,163,184,.1)',
                            color:t.is_winner?'var(--green)':'var(--muted)' }}>
                            {t.is_winner?'✓ Перемога':'Учасник'}
                          </span>
                        </td>
                        <td style={{ padding:'9px 12px', fontSize:11, color:'var(--muted)', maxWidth:160 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.buyer_name?.slice(0,30)}</div>
                          {t.buyer_phone && <div style={{ fontSize:10, color:'var(--accent)', marginTop:1 }}>{t.buyer_phone}</div>}
                        </td>
                        <td style={{ padding:'9px 12px', fontSize:10, color:'var(--faint)', whiteSpace:'nowrap' }}>
                          {t.date_created?.slice(0,10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ПОВ'ЯЗАНІ ОСОБИ ── */}
        {section==='persons' && (
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', gap:6, flexWrap:'wrap' }}>
              {['all',...Object.keys(ROLE_UA)].map(r=>(
                <span key={r} style={{ fontSize:11, padding:'3px 10px', borderRadius:4, cursor:'pointer',
                  background:'var(--bg3)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                  {r==='all'?'Всі':ROLE_UA[r]}
                  {r!=='all' && ` ${persons?.filter((p:any)=>p.role===r).length??0}`}
                </span>
              ))}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg3)' }}>
                  {["ПІБ","Роль","Частка","Адреса","Джерело","Актуально"].map(h=>(
                    <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, color:'var(--faint)', fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {persons?.map((p:any,i:number)=>(
                  <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 14px' }}>
                      <a href={`/person/${p.id}`} style={{ fontSize:12, fontWeight:500, color:'var(--accent)' }}>{p.full_name}</a>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4,
                        color: ROLE_COLOR[p.role]??'var(--muted)',
                        background:'var(--bg3)', border:`1px solid ${ROLE_COLOR[p.role]??'var(--border)'}33` }}>
                        {ROLE_UA[p.role]??p.role}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, fontFamily:'monospace', color:'var(--text)' }}>
                      {p.share_pct ? `${p.share_pct}%` : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'var(--muted)', maxWidth:200 }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.address?.slice(0,40)??'—'}</div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'var(--faint)' }}>{p.source}</td>
                    <td style={{ padding:'10px 14px', fontSize:10, color:'var(--faint)', fontFamily:'monospace' }}>
                      {p.is_active ? '✅ Так' : '⬜ Ні'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── САНКЦІЇ ── */}
        {section==='sanctions' && (
          <div>
            {sanctions?.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--green)', fontSize:14 }}>
                ✅ Санкцій не знайдено
              </div>
            ) : sanctions?.map((s:any,i:number)=>(
              <div key={i} style={{ background:'rgba(239,68,68,.08)', border:'1px solid var(--red)44',
                borderRadius:8, padding:14, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--red)' }}>🚫 {s.entity_name}</span>
                  <span style={{ fontSize:11, color:'var(--faint)' }}>{s.source}</span>
                </div>
                <KV k="Підстава"     v={s.reason}/>
                <KV k="Дата додання" v={s.date_added}/>
                <KV k="Діє до"       v={s.date_expires}/>
              </div>
            ))}
          </div>
        )}

        {/* ── СУДИ ── */}
        {section==='courts' && (
          <div>
            {courts?.length===0 ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--green)', fontSize:14 }}>
                ✅ Судових справ не знайдено
              </div>
            ) : courts?.map((c:any,i:number)=>(
              <div key={i} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:14, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:600, fontFamily:'monospace', color:'var(--accent)' }}>{c.case_number}</span>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4,
                    background:'var(--bg3)', color:'var(--muted)' }}>{c.status}</span>
                </div>
                <KV k="Суд"        v={c.court_name}/>
                <KV k="Категорія"  v={c.category}/>
                <KV k="Відкрито"   v={c.date_opened}/>
                {c.description && <div style={{ fontSize:11, color:'var(--muted)', marginTop:6, lineHeight:1.5 }}>{c.description}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── ГРАФОВІ ЗРАЗКИ для інших секцій ── */}
        {(section==='graph'||section==='buyer'||section==='history') && (
          <div style={{ padding:40, textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>
              {section==='graph'?'🔗':section==='buyer'?'🏛️':'🕐'}
            </div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:6 }}>
              {section==='graph' && 'Граф зв\'язків — завантажується через D3.js'}
              {section==='buyer' && 'Дані як замовника'}
              {section==='history' && 'Історія змін ЄДР'}
            </div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>Дані підвантажуються з PostgreSQL</div>
          </div>
        )}
      </div>
    </div>
  );
}
