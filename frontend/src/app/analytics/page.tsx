'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { api } from '@/lib/api';

const REGION_COLORS = ['#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444',
  '#06b6d4','#84cc16','#f97316','#ec4899','#14b8a6'];

export default function AnalyticsPage() {
  const [topWinners,  setTopWinners]  = useState<any[]>([]);
  const [byRegion,    setByRegion]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(()=>{
    Promise.all([
      api.getTopWinners({ limit:10 }),
      api.getByRegion(),
    ]).then(([w,r])=>{
      setTopWinners(w);
      setByRegion(r.slice(0,12));
    }).finally(()=>setLoading(false));
  },[]);

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳ Завантаження...</div>;

  const fmt = (n: number) => n>=1e9?`${(n/1e9).toFixed(1)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:`${(n/1e3).toFixed(0)}K`;

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:24 }}>
      <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:6 }}>📊 Аналітика</h1>
      <p style={{ fontSize:12, color:'var(--muted)', marginBottom:24 }}>Зведена статистика по всім тендерам Prozorro</p>

      {/* Top winners */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12,
        padding:20, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:16 }}>
          🏆 Топ-10 переможців тендерів за сумою
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={topWinners} layout="vertical" margin={{ left:20 }}>
            <XAxis type="number" tick={{ fill:'var(--faint)', fontSize:10 }}
              tickFormatter={fmt} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" tick={{ fill:'var(--text)', fontSize:10 }}
              axisLine={false} tickLine={false} width={200}
              tickFormatter={(v:string)=>v?.slice(0,28)+'…'}/>
            <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)',
              borderRadius:8, fontSize:11 }}
              formatter={(v:number)=>[`${v?.toLocaleString('uk-UA')} ₴`, 'Сума']}/>
            <Bar dataKey="total_amount" fill="var(--accent)" radius={[0,4,4,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* By region bar */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:14 }}>
            🗺️ Тендери по регіонах (топ-12)
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byRegion} layout="vertical">
              <XAxis type="number" tick={{ fill:'var(--faint)', fontSize:9 }}
                tickFormatter={fmt} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="region" tick={{ fill:'var(--text)', fontSize:9 }}
                axisLine={false} tickLine={false} width={120}
                tickFormatter={(v:string)=>v?.replace(' область','')?.replace('ська','.')}/>
              <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)',
                borderRadius:8, fontSize:11 }}
                formatter={(v:number)=>[`${v?.toLocaleString('uk-UA')} ₴`,'Сума']}/>
              <Bar dataKey="total_amount" fill="var(--green)" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By region pie */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:14 }}>
            Розподіл по регіонах
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byRegion.slice(0,8)} cx="50%" cy="50%"
                innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="total_amount">
                {byRegion.slice(0,8).map((_:any,i:number)=>(
                  <Cell key={i} fill={REGION_COLORS[i % REGION_COLORS.length]}/>
                ))}
              </Pie>
              <Tooltip contentStyle={{ background:'var(--bg2)', border:'1px solid var(--border)',
                borderRadius:8, fontSize:11 }}
                formatter={(v:number)=>[`${v?.toLocaleString('uk-UA')} ₴`]}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8 }}>
            {byRegion.slice(0,6).map((r:any,i:number)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
                <div style={{ width:10, height:10, borderRadius:2, flexShrink:0,
                  background:REGION_COLORS[i%REGION_COLORS.length]}}/>
                <span style={{ flex:1, color:'var(--text)', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {r.region?.replace(' область','')}
                </span>
                <span style={{ color:'var(--faint)', fontFamily:'monospace', fontSize:10 }}>
                  {fmt(r.total_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top winners table */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12,
        padding:20, marginTop:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:14 }}>
          Детальна таблиця переможців
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--bg3)' }}>
              {['#','ЄДРПОУ','Назва','Перемог','Загальна сума','Середній контракт'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11,
                  color:'var(--faint)', fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topWinners.map((w:any, i:number)=>(
              <tr key={i} style={{ borderTop:'1px solid var(--border)', cursor:'pointer' }}
                onMouseOver={e=>(e.currentTarget.style.background='var(--bg3)')}
                onMouseOut={e=>(e.currentTarget.style.background='')}
                onClick={()=>window.location.href=`/company/${w.edrpou}`}>
                <td style={{ padding:'10px 12px', fontSize:14, color:'var(--faint)',
                  fontWeight:700, textAlign:'center' }}>
                  {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                </td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11,
                  color:'var(--accent)' }}>{w.edrpou}</td>
                <td style={{ padding:'10px 12px', fontSize:12, fontWeight:500, color:'var(--text)',
                  maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {w.name}
                </td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:12,
                  color:'var(--green)', fontWeight:600 }}>{w.wins}</td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:12,
                  color:'var(--amber)', fontWeight:600 }}>
                  {w.total_amount?.toLocaleString('uk-UA')} ₴
                </td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11,
                  color:'var(--muted)' }}>
                  {Math.round(w.avg_amount)?.toLocaleString('uk-UA')} ₴
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
