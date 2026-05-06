'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';

export function TopNav() {
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    const t = setTimeout(async () => {
      try { const r = await api.quickSearch(q); setResults(r); setOpen(true); }
      catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav style={{
      background:'var(--bg2)', borderBottom:'1px solid var(--border)',
      height:52, display:'flex', alignItems:'center', padding:'0 20px',
      gap:20, position:'sticky', top:0, zIndex:100, flexShrink:0,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
        <span style={{ fontSize:20 }}>🔷</span>
        <span style={{ fontSize:14, fontWeight:700, color:'var(--text)', letterSpacing:-.3 }}>
          Prozorro<span style={{ color:'var(--accent)' }}>Analytics</span>
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display:'flex', gap:4 }}>
        {[
          ['/search/companies','Компанії'],
          ['/search/tenders','Тендери'],
          ['/search/persons','Особи'],
          ['/analytics','Аналітика'],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={{
            fontSize:12, color:'var(--muted)', padding:'5px 10px', borderRadius:6,
          }}>{label}</Link>
        ))}
      </div>

      {/* Search */}
      <div ref={ref} style={{ flex:1, maxWidth:420, position:'relative' }}>
        <input
          value={q} onChange={e=>setQ(e.target.value)}
          onFocus={()=>q.length>=2&&setOpen(true)}
          placeholder="🔍 Пошук по ЄДРПОУ, назві компанії або ПІБ..."
          style={{
            width:'100%', background:'var(--bg3)', border:'1px solid var(--border)',
            borderRadius:8, padding:'6px 12px', fontSize:12, color:'var(--text)',
          }}
        />
        {open && results && (
          <div style={{
            position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
            background:'var(--bg2)', border:'1px solid var(--border)',
            borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.15)',
            zIndex:200, overflow:'hidden',
          }}>
            {results.companies?.length > 0 && (
              <>
                <div style={{ padding:'8px 14px 4px', fontSize:10, color:'var(--faint)', fontWeight:700, letterSpacing:.8 }}>КОМПАНІЇ</div>
                {results.companies.map((c: any) => (
                  <div key={c.edrpou}
                    onClick={() => { router.push(`/company/${c.edrpou}`); setOpen(false); setQ(''); }}
                    style={{ padding:'8px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                    onMouseOver={e=>(e.currentTarget.style.background='var(--bg3)')}
                    onMouseOut={e=>(e.currentTarget.style.background='')}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text)' }}>{c.name?.slice(0,50)}</div>
                      <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{c.edrpou} · {c.region}</div>
                    </div>
                    <span style={{
                      fontSize:10, padding:'2px 6px', borderRadius:4,
                      background: c.status==='зареєстровано' ? '#dcfce7' : '#fee2e2',
                      color: c.status==='зареєстровано' ? '#166534' : '#991b1b',
                    }}>{c.status}</span>
                  </div>
                ))}
              </>
            )}
            {results.persons?.length > 0 && (
              <>
                <div style={{ padding:'8px 14px 4px', fontSize:10, color:'var(--faint)', fontWeight:700, letterSpacing:.8, borderTop:'1px solid var(--border)' }}>ОСОБИ</div>
                {results.persons.map((p: any) => (
                  <div key={p.id}
                    onClick={() => { router.push(`/person/${p.id}`); setOpen(false); setQ(''); }}
                    style={{ padding:'8px 14px', cursor:'pointer' }}
                    onMouseOver={e=>(e.currentTarget.style.background='var(--bg3)')}
                    onMouseOut={e=>(e.currentTarget.style.background='')}>
                    <div style={{ fontSize:12, color:'var(--text)' }}>{p.full_name}</div>
                    <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>{p.co} компаній</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Theme toggle */}
      <button onClick={toggle} style={{
        marginLeft:'auto', background:'var(--bg3)', border:'1px solid var(--border)',
        borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, color:'var(--text)',
      }} title="Змінити тему">
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </nav>
  );
}

// Кнопка експорту з трьома форматами
export function ExportButton({ params, label = 'Експорт' }: { params: Record<string,any>; label?: string }) {
  const [open, setOpen] = useState(false);
  const { exportUrl } = api;

  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:'var(--green)', color:'#fff', border:'none',
        borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer',
        display:'flex', alignItems:'center', gap:6,
      }}>
        📥 {label} ▾
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100%+6px)', right:0,
          background:'var(--bg2)', border:'1px solid var(--border)',
          borderRadius:8, overflow:'hidden', minWidth:140,
          boxShadow:'0 4px 16px rgba(0,0,0,.1)', zIndex:50,
        }}>
          {(['xlsx','csv','pdf'] as const).map(fmt => (
            <a key={fmt} href={exportUrl(fmt, params)} download
              onClick={()=>setOpen(false)}
              style={{ display:'block', padding:'8px 14px', fontSize:12, color:'var(--text)',
                textDecoration:'none' }}
              onMouseOver={e=>(e.currentTarget.style.background='var(--bg3)')}
              onMouseOut={e=>(e.currentTarget.style.background='')}>
              {fmt==='xlsx'?'📊':fmt==='csv'?'📄':'📋'} {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
