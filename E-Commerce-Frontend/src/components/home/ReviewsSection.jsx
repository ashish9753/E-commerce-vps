const reviews = [
  { text: 'Excellent service! Got my refrigerator delivered the next day and the installation team was very professional.', name: 'Suman Shrestha', place: 'Lalitpur', rating: 5 },
  { text: 'Best prices in Kathmandu for electronics. Genuine warranty support without any hassle.', name: 'Priya Tamang', place: 'Bhaktapur', rating: 5 },
  { text: 'Ordered an AC and installation was done within 24 hours. Top-notch after-sales support.', name: 'Rajan KC', place: 'Kathmandu', rating: 5 },
];

export default function ReviewsSection() {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '20px 20px', boxShadow: '0 1px 3px #0000000d', marginBottom: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', marginBottom: 16 }}>What our customers say</div>
      <div className="r-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {reviews.map((r, i) => (
          <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '16px', border: '1px solid #e5e7eb' }}>
            <div style={{ color: '#FF5A1F', fontSize: 28, lineHeight: 1, marginBottom: 8, fontFamily: 'Georgia, serif' }}>"</div>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 14 }}>{r.text}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FF5A1F', color: 'white',
                fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                {r.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.place} · {'★'.repeat(r.rating)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
