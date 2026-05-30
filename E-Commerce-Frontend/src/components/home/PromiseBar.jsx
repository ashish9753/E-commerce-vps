const items = [
  { ic: '🚚', name: 'Free Delivery', dsc: 'On orders above Rs. 5,000 in Kathmandu Valley' },
  { ic: '🛡️', name: 'Authorized Warranty', dsc: 'Brand warranty on every product we sell' },
  { ic: '🔄', name: 'Easy Returns', dsc: '7-day hassle-free return via our portal' },
  { ic: '📞', name: '24/7 Support', dsc: 'Customer care available round the clock' },
];

export default function PromiseBar() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: 'white', borderRadius: 8, padding: '16px 16px',
          boxShadow: '0 1px 3px #0000000d', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f8fafc', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{item.ic}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{item.dsc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
