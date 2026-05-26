'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';

export function TopNav() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const NAV_LINKS = [
    ['/search/companies','Компанії'],
    ['/search/tenders','Тендери'],
    ['/search/persons','Особи'],
    ['/analytics','Аналітика'],
  ];

  return (
    <>
      <nav style={{
        background:'#0B1B33', borderBottom:'1px solid rgba(0,115,255,0.2)',
        height:56, display:'flex', alignItems:'center', padding:'0 16px',
        gap:12, position:'sticky', top:0, zIndex:100, flexShrink:0,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', flexShrink:0 }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <ellipse cx="15" cy="23" rx="12" ry="3.5" stroke="#0073FF" strokeWidth="1.8" fill="none"/>
            <rect x="5" y="12" width="5" height="10" rx="1.5" fill="#FFFFFF"/>
            <rect x="12.5" y="6" width="5" height="16" rx="1.5" fill="#0073FF"/>
            <rect x="20" y="15" width="5" height="7" rx="1.5" fill="#FFFFFF"/>
          </svg>
          <span style={{ fontSize:14, fontWeight:800, letterSpacing:.5, color:'#FFFFFF' }}>
            TENDER<span style={{ color:'#0073FF' }}>360</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div style={{ display:'flex', gap:4, flex:1 }} className="desktop-only">
          {NAV_LINKS.map(([href, label]) => (
            <Link key={href} href={href} style={{
              fontSize:12, color: pathname === href ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              padding:'5px 10px', borderRadius:6, fontWeight: pathname === href ? 600 : 400,
              textDecoration:'none',
            }}>{label}</Link>
          ))}
        </div>

        {/* Desktop search */}
        {pathname !== '/' && (
          <div ref={ref} style={{ flex:1, maxWidth:420, position:'relative' }} className="desktop-only">
            <input
              value={q} onChange={e=>setQ(e.target.value)}
              onFocus={()=>q.length>=2&&setOpen(true)}
              placeholder="🔍 Пошук по ЄДРПОУ, назві компанії або ПІБ..."
              style={{
                width:'100%', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:8, padding:'6px 12px', fontSize:12, color:'#FFFFFF',
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
        )}

        {/* Spacer on desktop */}
        <div style={{ flex:1 }} className="desktop-only" />

        {/* Theme toggle */}
        <button onClick={toggle} style={{
          background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)',
          borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, color:'#FFFFFF',
          flexShrink:0,
        }} title="Змінити тему">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Burger button - mobile only */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="mobile-only"
          style={{
            background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)',
            borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'#FFFFFF',
            fontSize:18, lineHeight:1, flexShrink:0,
          }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-only" style={{
          position:'fixed', top:56, left:0, right:0, bottom:0,
          background:'#0B1B33', zIndex:99, padding:20,
          display:'flex', flexDirection:'column', gap:4,
        }}>
          {/* Mobile search */}
          {pathname !== '/' && (
            <div style={{ marginBottom:16 }}>
              <input
                value={q} onChange={e=>setQ(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && q.trim()) { router.push(`/search/companies?q=${encodeURIComponent(q)}`); setMenuOpen(false); }}}
                placeholder="🔍 Пошук..."
                style={{
                  width:'100%', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)',
                  borderRadius:10, padding:'12px 16px', fontSize:14, color:'#FFFFFF',
                }}
              />
            </div>
          )}
          {NAV_LINKS.map(([href, label]) => (
            <Link key={href} href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontSize:18, color: pathname === href ? '#0073FF' : '#FFFFFF',
                padding:'14px 16px', borderRadius:10, fontWeight:600,
                textDecoration:'none', borderBottom:'1px solid rgba(255,255,255,0.08)',
              }}>{label}</Link>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
        @media (min-width: 641px) {
          .desktop-only { display: flex !important; }
          .mobile-only { display: none !important; }
        }
      `}</style>
    </>
  );
}

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
