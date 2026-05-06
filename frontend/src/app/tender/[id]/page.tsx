'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function TenderPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api.getTender(id).then(setData).catch(()=>setData(null)).finally(()=>setLoading(false));
  },[id]);

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--muted)' }}>⏳</div>;
  if (!data)   return <div style={{ padding:40, textAlign:'center', color:'var(--red)' }}>Тендер не знайдено</div>;

  const { tender, bids, items } = data;
  const winner = bids?.find((b:any)=>b.is_winner);

  return (
    <div style={{ maxWidth:960, margin:'0 auto', padding:24 }}>
      {/* Header */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)',
        borderRadius:12, padding:20, marginBottom:16 }}>
        <div style={{ fontFamily:'monospace', fontSize:11, color:'var(--accent)', marginBottom:6 }}>
          {tender.tender_id}
        </div>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', marginBottom:10 }}>
          {tender.title}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:4,
            background:'var(--bg3)', color:'var(--muted)' }}>
            {tender.procurement_method_type}
          </span>
          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:4,
            background: tender.status==='complete'?'rgba(16,185,129,.1)':'var(--bg3)',
            color: tender.status==='complete'?'var(--green)':'var(--muted)' }}>
            {tender.status}
          </span>
          {tender.cpv_code && (
            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:4,
              background:'var(--tag-bg)', color:'var(--tag-text)' }}>
              CPV: {tender.cpv_code}
            </span>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
        {/* Amounts */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--faint)', letterSpacing:.8, marginBottom:12 }}>СУМИ</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:'var(--faint)', marginBottom:2 }}>Очікувана вартість</div>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', fontFamily:'monospace' }}>
              {tender.amount?.toLocaleString('uk-UA')} {tender.currency}
            </div>
          </div>
          {winner && (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
              <div style={{ fontSize:10, color:'var(--faint)', marginBottom:2 }}>Сума договору</div>
              <div style={{ fontSize:18, fontWeight:700, color:'var(--green)', fontFamily:'monospace' }}>
                {winner.amount?.toLocaleString('uk-UA')} {tender.currency}
              </div>
              {winner.amount && tender.amount && (
                <div style={{ fontSize:11, color:'var(--green)', marginTop:4 }}>
                  Економія: {((1-winner.amount/tender.amount)*100).toFixed(2)}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buyer */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--faint)', letterSpacing:.8, marginBottom:12 }}>ЗАМОВНИК</div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{tender.buyer_name}</div>
          <div style={{ fontSize:11, fontFamily:'monospace', color:'var(--accent)', marginBottom:6 }}>#{tender.buyer_edrpou}</div>
          {tender.buyer_address && <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>📍 {tender.buyer_address}</div>}
          {tender.buyer_phone  && <div style={{ fontSize:11, color:'var(--text)', marginBottom:4 }}>📞 {tender.buyer_phone}</div>}
          {tender.buyer_email  && <div style={{ fontSize:11, color:'var(--accent)' }}>✉️ {tender.buyer_email}</div>}
        </div>
      </div>

      {/* Items */}
      {items?.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10,
          padding:16, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:12 }}>
            Предмети закупівлі ({items.length})
          </div>
          {items.map((item:any, i:number) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'8px 0',
              borderBottom: i<items.length-1?'1px solid var(--border)':'' }}>
              <span style={{ fontSize:11, fontFamily:'monospace', color:'var(--accent)',
                minWidth:60 }}>{item.cpv_code}</span>
              <span style={{ fontSize:12, color:'var(--text)', flex:1 }}>{item.description}</span>
              <span style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>
                {item.quantity && `${item.quantity} ${item.unit??''}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bids */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)',
          fontSize:12, fontWeight:700, color:'var(--text)' }}>
          Учасники торгів ({bids?.length ?? 0})
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--bg3)' }}>
              {['Учасник','ЄДРПОУ','Ставка','Статус','Контакт','Результат'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11,
                  color:'var(--faint)', fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bids?.map((b:any,i:number)=>(
              <tr key={i} style={{ borderTop:'1px solid var(--border)',
                background: b.is_winner?'rgba(16,185,129,.05)':'' }}>
                <td style={{ padding:'10px 12px' }}>
                  <a href={`/company/${b.edrpou}`} style={{ fontSize:12, fontWeight:500, color:'var(--accent)' }}>
                    {b.name}
                  </a>
                </td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11, color:'var(--faint)' }}>
                  {b.edrpou}
                </td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:12,
                  color:'var(--text)', fontWeight:500 }}>
                  {b.amount?.toLocaleString('uk-UA')} ₴
                </td>
                <td style={{ padding:'10px 12px', fontSize:11, color:'var(--muted)' }}>{b.status}</td>
                <td style={{ padding:'10px 12px' }}>
                  {b.phone && <div style={{ fontSize:11, color:'var(--text)' }}>📞 {b.phone}</div>}
                  {b.email && <div style={{ fontSize:11, color:'var(--accent)', marginTop:2 }}>✉️ {b.email}</div>}
                </td>
                <td style={{ padding:'10px 12px' }}>
                  {b.is_winner
                    ? <span style={{ fontSize:11, color:'var(--green)', fontWeight:700 }}>🏆 Переможець</span>
                    : <span style={{ fontSize:11, color:'var(--faint)' }}>Учасник</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
