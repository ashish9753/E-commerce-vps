import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Play } from 'lucide-react';
import { mediaApi } from '../api/media';
import { mediaThumbnail, PLATFORM, isVideoType } from '../utils/media';

// Social-profile handles (kept in sync with Footer.jsx / SocialShowcase.jsx).
const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/trade_ngine' },
  { label: 'Facebook',  href: 'https://www.facebook.com/tradengin' },
  { label: 'TikTok',    href: 'https://www.tiktok.com/@tradengine' },
];
const DEFAULT_HANDLE = 'tradengine';

// Inline brand SVGs — the installed lucide-react build doesn't ship brand
// glyphs, so we mirror the Footer / showcase icons here.
function PlatformIcon({ type, size = 20, className }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', className };
  switch (type) {
    case 'instagram':
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>;
    case 'facebook':
      return <svg {...p} fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>;
    case 'youtube':
      return <svg {...p} fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.97C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff" /></svg>;
    case 'tiktok':
      return <svg {...p} fill="currentColor"><path d="M21 8.5a6.5 6.5 0 0 1-4.2-1.54v6.79a5.75 5.75 0 1 1-5.75-5.75c.2 0 .4.01.6.03v2.92a2.86 2.86 0 1 0 2.01 2.73V2h2.83a3.67 3.67 0 0 0 .06.67A3.68 3.68 0 0 0 18 5.42 3.65 3.65 0 0 0 21 5.6z" /></svg>;
    default:
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;
  }
}

const fmtCount = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 >= 100 ? 1 : 0)}K`;
  return String(v);
};
const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
};

export default function SocialMediaPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    mediaApi.getActive()
      .then(({ data }) => { if (alive) setItems(data.data?.media || []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Build the filter list from the platforms that actually have posts.
  const platforms = useMemo(() => {
    const present = [...new Set(items.map(i => i.type))];
    const order = ['instagram', 'facebook', 'tiktok', 'youtube', 'drive', 'image', 'video', 'link'];
    return order.filter(t => present.includes(t));
  }, [items]);

  const visible = filter === 'all' ? items : items.filter(i => i.type === filter);
  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div className="smp">
      <div className="smp-wrap">
        <div className="smp-head">
          <div>
            <div className="smp-kicker">Follow our journey</div>
            <h1 className="smp-title">Social Media</h1>
            <p className="smp-sub">Events, launches &amp; behind the scenes — every post in one place.</p>
          </div>
          <div className="smp-socials">
            {SOCIALS.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="smp-social">{s.label}</a>
            ))}
          </div>
        </div>

        {/* Platform filter */}
        {platforms.length > 1 && (
          <div className="smp-filters">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
            {platforms.map(t => (
              <button key={t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>
                {PLATFORM[t]?.label || t}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="smp-empty">Loading posts…</div>
        ) : visible.length === 0 ? (
          <div className="smp-empty">No posts to show yet. Check back soon!</div>
        ) : (
          <div className="smp-grid">
            {visible.map(item => {
              const thumb = mediaThumbnail(item);
              const plat = PLATFORM[item.type] || PLATFORM.link;
              const hasStats = (item.likes || 0) > 0 || (item.comments || 0) > 0;
              return (
                <article key={item._id} className="smp-card" onClick={() => open(item.url)}
                  role="link" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') open(item.url); }}>
                  <div className="smp-card-head">
                    <div className="smp-id">
                      <span className="smp-handle">{item.handle || DEFAULT_HANDLE}</span>
                      <span className="smp-date">{fmtDate(item.createdAt)}</span>
                    </div>
                    <PlatformIcon type={item.type} size={20} className="smp-plat" />
                  </div>

                  <div className="smp-media">
                    {thumb ? (
                      <img src={thumb} alt={item.title || plat.label} loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                    ) : null}
                    <span className="smp-fallback" style={{ display: thumb ? 'none' : 'flex', background: plat.color }}>
                      <PlatformIcon type={item.type} size={34} />
                      <span className="smp-fallback-label">{item.title || plat.label}</span>
                    </span>
                    {isVideoType(item.type) && <span className="smp-reel"><Play size={13} fill="#fff" /></span>}
                  </div>

                  <div className="smp-body">
                    {hasStats && (
                      <div className="smp-stats">
                        <span><Heart size={17} /> {fmtCount(item.likes)}</span>
                        <span><MessageCircle size={17} /> {fmtCount(item.comments)}</span>
                      </div>
                    )}
                    {item.title && <p className="smp-cap">{item.title}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .smp { background: linear-gradient(180deg, #fff 0%, #fff8f2 100%); min-height: 70vh; }
        .smp-wrap { max-width: 1400px; margin: 0 auto; padding: 32px 24px 56px; }

        .smp-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .smp-kicker { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #f97316; }
        .smp-title { margin: 6px 0 0; font-size: clamp(24px, 3.4vw, 38px); font-weight: 800; color: #131921; font-family: 'Syne', sans-serif; }
        .smp-sub { margin: 6px 0 0; font-size: 14px; color: #6b7280; }
        .smp-socials { display: flex; gap: 8px; }
        .smp-social { font-size: 12px; font-weight: 700; color: #131921; background: #fff; border: 1px solid #e4e7ec;
          padding: 8px 16px; border-radius: 999px; text-decoration: none; transition: all .15s; }
        .smp-social:hover { border-color: #f97316; color: #f97316; }

        .smp-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
        .smp-filters button { font-size: 12.5px; font-weight: 700; color: #4b5159; background: #fff; border: 1px solid #e4e7ec;
          padding: 7px 16px; border-radius: 999px; cursor: pointer; transition: all .15s; }
        .smp-filters button:hover { border-color: #f97316; color: #f97316; }
        .smp-filters button.active { background: #f97316; border-color: #f97316; color: #fff; }

        .smp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 18px; }

        .smp-card { background: #fff; border: 1px solid #ececf0; border-radius: 12px; overflow: hidden; cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,.05); transition: transform .18s, box-shadow .18s; text-align: left; }
        .smp-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,.13); }

        .smp-card-head { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; }
        .smp-id { display: flex; flex-direction: column; min-width: 0; }
        .smp-handle { font-size: 13.5px; font-weight: 700; color: #131921; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .smp-date { font-size: 11px; color: #8b8f98; margin-top: 1px; }
        .smp-plat { color: #131921; flex-shrink: 0; }

        .smp-media { position: relative; width: 100%; aspect-ratio: 1 / 1; background: #f0f2f5; }
        .smp-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .smp-fallback { position: absolute; inset: 0; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #fff; text-align: center; padding: 14px; }
        .smp-fallback-label { font-size: 12px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .smp-reel { position: absolute; top: 9px; right: 9px; width: 26px; height: 26px; border-radius: 7px;
          background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; color: #fff; }

        .smp-body { padding: 11px 13px 14px; }
        .smp-stats { display: flex; gap: 16px; margin-bottom: 8px; }
        .smp-stats span { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: #1f2430; }
        .smp-stats svg { color: #6b7280; }
        .smp-cap { margin: 0; font-size: 12.5px; line-height: 1.45; color: #4b5159;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

        .smp-empty { text-align: center; padding: 80px 20px; color: #8b8f98; font-size: 15px; font-weight: 600; }

        @media (max-width: 640px) {
          .smp-wrap { padding: 24px 12px 44px; }
          .smp-grid { grid-template-columns: repeat(auto-fill, minmax(45%, 1fr)); gap: 12px; }
        }
      `}</style>
    </div>
  );
}
