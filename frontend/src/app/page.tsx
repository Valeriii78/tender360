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
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'calc(100vh - 52px)', padding:20, gap:32 }}>

      {/* Hero */}
      <div style={{ textAlign:'center', maxWidth:600 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔷</div>
        <h1 style={{ fontSize:32, fontWeight:700, color:'var(--text)', marginBottom:12, lineHeight:1.2 }}>
          Prozorro Analytics
        </h1>
        <p style={{ fontSize:15, color:'var(--muted)', lineHeight:1.6 }}>
          Безкоштовна аналітика державних закупівель України.<br/>
          Перевірка компаній, зв'язки засновників, конкуренти, судові справи.
        </p>
      </div>

      {/* Search box */}
      <div style={{ width:'100%', maxWidth:560 }}>
        <div style={{ display:'flex', gap:8 }}>
          <input
            value={q} onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&search()}
            placeholder="Назва компанії, ЄДРПОУ або ПІБ особи..."
            style={{
              flex:1, background:'var(--bg2)', border:'2px solid var(--border)',
              borderRadius:10, padding:'12px 16px', fontSize:14, color:'var(--text)',
            }}
            autoFocus
          />
          <button onClick={search} style={{
            background:'var(--accent)', color:'#fff', border:'none',
            borderRadius:10, padding:'12px 24px', fontSize:14, fontWeight:600, cursor:'pointer',
          }}>Знайти</button>
        </div>
        <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
          {['ЄДРПОУ','Назва компанії','ПІБ особи','Адреса'].map(t=>(
            <span key={t} style={{ fontSize:11, color:'var(--faint)', background:'var(--bg3)',
              padding:'3px 10px', borderRadius:20, border:'1px solid var(--border)' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', justifyContent:'center' }}>
        {[
          { icon:'🏢', label:'Компаній та ФОП',   val:'4.5 млн+' },
          { icon:'📋', label:'Тендерів Prozorro',  val:'3.2 млн+' },
          { icon:'👤', label:'Фізичних осіб',      val:'8 млн+' },
          { icon:'💰', label:'Загальна сума',       val:'₴ 8.4 трлн' },
        ].map(s=>(
          <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:12, padding:'16px 24px', textAlign:'center', minWidth:140 }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'monospace' }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature chips */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', maxWidth:600 }}>
        {[
          '✅ Безкоштовно','🔓 Без реєстрації','📥 Експорт XLS/CSV/PDF',
          '🌙 Темна тема','🔗 Граф зв\'язків','🗺️ Карта по областях',
          '📅 Календар активності','⚖️ Судові справи','🚫 Санкційні списки',
        ].map(f=>(
          <span key={f} style={{ fontSize:12, color:'var(--text2)', background:'var(--bg2)',
            border:'1px solid var(--border)', padding:'5px 12px', borderRadius:20 }}>{f}</span>
        ))}
      </div>
    </div>
  );
}
