import { useNavigate } from 'react-router-dom';
import { useCatalog, getCatEmoji } from '../../context/CatalogContext';

const FALLBACK_CATS = [
  { name: 'Televisions',       subs: ['Smart TV', '4K TV', 'OLED', 'QLED'] },
  { name: 'Smartphones',       subs: ['Android', 'iPhones', 'Tablets', 'Accessories'] },
  { name: 'Laptops',           subs: ['Ultrabooks', 'Gaming', 'Business', '2-in-1'] },
  { name: 'Refrigerators',     subs: ['Single Door', 'Double Door', 'Side-by-Side', 'French Door'] },
  { name: 'Air Conditioners',  subs: ['Split AC', 'Window AC', 'Tower AC', 'Cassette'] },
  { name: 'Kitchen Appliances',subs: ['Microwave', 'Mixer', 'Gas Stove', 'Coffee Maker'] },
  { name: 'Audio',             subs: ['Soundbars', 'Headphones', 'Earbuds', 'Speakers'] },
  { name: 'Gaming',            subs: ['Consoles', 'Gaming PCs', 'Accessories', 'Chairs'] },
];

function CatCard({ cat, subs, navigate }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '16px 16px 0', cursor: 'pointer',
      boxShadow: '0 1px 3px #0000000d' }}
      onClick={() => navigate(`/products?category=${encodeURIComponent(cat.name)}`)}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: '#0f172a' }}>
        {getCatEmoji(cat.name)} Shop {cat.name}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {subs.slice(0, 4).map(sub => (
          <div key={sub}
            onClick={e => { e.stopPropagation(); navigate(`/products?category=${encodeURIComponent(cat.name)}`); }}
            style={{ background: '#f8fafc', borderRadius: 6, padding: '10px 8px', textAlign: 'center',
              fontSize: 11, fontWeight: 600, color: '#374151', cursor: 'pointer', border: '1px solid #f1f5f9' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
            {sub}
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 0 12px', fontSize: 12, color: '#007185', fontWeight: 600 }}>
        See all →
      </div>
    </div>
  );
}

export default function CategoryGrid() {
  const navigate = useNavigate();
  const { topCategories, getSubcats } = useCatalog();

  const catsToShow = topCategories.length > 0
    ? topCategories.slice(0, 8).map(cat => ({
        name: cat.name,
        subs: getSubcats(cat._id).map(s => s.name),
      }))
    : FALLBACK_CATS;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
      {catsToShow.map(cat => (
        <CatCard key={cat.name} cat={cat} subs={cat.subs} navigate={navigate} />
      ))}
    </div>
  );
}
