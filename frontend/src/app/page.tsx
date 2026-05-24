'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [q, setQ] = useState('');
  const router = useRouter();

  const search = () => {
    if (!q.trim()) return;
    const isEdrpou = /^\d{8,10}$/.test(q.trim());
    if (isEdrpou) router.push(`/company/${q.trim()}`);
    else router.push(`/search/companies?q=${encodeURIComponent(q)}`);
  };

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'calc(100vh - 56px)', padding:'40px 20px', gap:40,
    }}>

      {/* Logo + Title */}
      <div style={{ textAlign:'center' }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ marginBottom:16 }}>
          {/* Oval */}
          <ellipse cx="36" cy="54" rx="30" ry="9" stroke="#0073FF" strokeWidth="3" fill="none"/>
          {/* Bars */}
          <rect x="16" y="28" width="9" height="24" rx="2" fill="#0B1B33" opacity="0.7"/>
          <rect x="31" y="16" width="10" height="36" rx="2" fill="#0073FF"/>
          <rect x="47" y="34" width="9" height="18" rx="2" fill="#0B1B33" opacity="0.5"/>
        </svg>
        <div style={{ fontSize:36, fontWeight:800, letterSpacing:1, marginBottom:10 }}>
          <span style={{ color:'var(--text)' }}>TENDER</span>
          <span style={{ color:'#0073FF' }}>360</span>
        </div>
        <p style={{ fontSize:15, color:'var(--muted)', lineHeight:1.7, maxWidth:480 }}>
          Безкоштовна аналітика державних закупівель України.<br/>
          Перевірка компаній, звʼязки засновників, конкуренти, судові справи.
        </p>
      </div>

      {/* Search */}
      <div style={{ width:'100%', maxWidth:580 }}>
        <div style={{ display:'flex', gap:10, boxShadow:'0 4px 24px rgba(0,115,255,0.12)', borderRadius:12 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Назва компанії, ЄДРПОУ або ПІБ особи..."
            autoFocus
            style={{
              flex:1, background:'var(--bg2)', border:'2px solid var(--border)',
              borderRadius:'12px 0 0 12px', padding:'14px 18px',
              fontSize:14, color:'var(--text)',
              borderRight:'none',
            }}
          />
          <button onClick={search} style={{
            background:'#0073FF', color:'#fff', border:'none',
            borderRadius:'0 12px 12px 0', padding:'14px 28px',
            fontSize:14, fontWeight:700, cursor:'pointer',
            whiteSpace:'nowrap',
          }}>
            Знайти
          </button>
        </div>
        <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
          {['ЄДРПОУ','Назва компанії','ПІБ особи','Адреса'].map(t => (
            <span key={t} style={{
              fontSize:11, color:'var(--faint)', background:'var(--bg3)',
              padding:'3px 12px', borderRadius:20, border:'1px solid var(--border)',
              cursor:'pointer',
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', justifyContent:'center' }}>
        {[
          { icon:'🏢', label:'Компаній та ФОП',  val:'4.5 млн+' },
          { icon:'📋', label:'Тендерів Prozorro', val:'3.2 млн+' },
          { icon:'👤', label:'Фізичних осіб',     val:'8 млн+' },
          { icon:'💰', label:'Загальна сума',      val:'₴ 8.4 трлн' },
        ].map(s => (
          <div key={s.label} style={{
            background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:14, padding:'18px 28px', textAlign:'center', minWidth:150,
            boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize:26, marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:'#0073FF', fontFamily:'monospace' }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', maxWidth:620 }}>
        {[
          '✅ Безкоштовно','🔓 Без реєстрації','📥 Експорт XLS/CSV/PDF',
          '🌙 Темна тема','🔗 Граф звʼязків','🗺 Карта по областях',
          '📅 Календар активності','⚖ Судові справи','🚫 Санкційні списки',
        ].map(f => (
          <span key={f} style={{
            fontSize:12, color:'var(--text2)', background:'var(--bg2)',
            padding:'5px 14px', borderRadius:20,
            border:'1px solid var(--border)',
          }}>{f}</span>
        ))}
      </div>
    </div>
  );
}
