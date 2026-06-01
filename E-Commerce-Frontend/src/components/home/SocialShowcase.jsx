import { useEffect, useRef, useState } from 'react';
import {
  Heart, MessageCircle, Instagram, Facebook, Youtube, Music2,
  Image as ImageIcon, Play, Link2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { mediaApi } from '../../api/media';
import { mediaThumbnail, PLATFORM, isVideoType } from '../../utils/media';

// Social-profile handles (kept in sync with Footer.jsx).
const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/trade_ngine' },
  { label: 'Facebook',  href: 'https://www.facebook.com/tradengin' },
  { label: 'TikTok',    href: 'https://www.tiktok.com/@tradengine' },
];
const DEFAULT_HANDLE = 'tradengine';

const PLATFORM_ICON = {
  instagram: Instagram, facebook: Facebook, youtube: Youtube,
  tiktok: Music2, drive: Link2, image: ImageIcon, video: Play, link: Link2,
};

const fmtCount = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 >= 100 ? 1 : 0)}K`;
  return String(v);
};
const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
};

export default function SocialShowcase() {
  const [items, setItems] = useState([]);
  const trackRef = useRef(null);

  useEffect(() => {
    let alive = true;
    mediaApi.getActive()
      .then(({ data }) => { if (alive) setItems(data.data?.media || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!items.length) return null;

  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');
  const scrollByCard = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('.sf-card');
    const step = card ? card.offsetWidth + 16 : 300;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section className="sf">
      <div className="sf-wrap">
        <div className="sf-panel">
          {/* Pill heading tab */}
          <div className="sf-pill">📸 Social Footprints</div>

          <div className="sf-head">
            <div>
              <div className="sf-kicker">Follow our journey</div>
              <h2 className="sf-title">Events, launches &amp; behind the scenes</h2>
            </div>
            <div className="sf-socials">
              {SOCIALS.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="sf-social">{s.label}</a>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="sf-track" ref={trackRef}>
            {items.map(item => {
              const thumb = mediaThumbnail(item);
              const plat = PLATFORM[item.type] || PLATFORM.link;
              const Icon = PLATFORM_ICON[item.type] || Link2;
              const hasStats = (item.likes || 0) > 0 || (item.comments || 0) > 0;
              return (
                <article key={item._id} className="sf-card" onClick={() => open(item.url)}
                  role="link" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') open(item.url); }}>
                  <div className="sf-card-head">
                    <div className="sf-id">
                      <span className="sf-handle">{item.handle || DEFAULT_HANDLE}</span>
                      <span className="sf-date">{fmtDate(item.createdAt)}</span>
                    </div>
                    <Icon size={20} className="sf-plat" />
                  </div>

                  <div className="sf-media">
                    {thumb ? (
                      <img src={thumb} alt={item.title || plat.label} loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                    ) : null}
                    <span className="sf-fallback" style={{ display: thumb ? 'none' : 'flex', background: plat.color }}>
                      <Icon size={34} />
                      <span className="sf-fallback-label">{item.title || plat.label}</span>
                    </span>
                    {isVideoType(item.type) && <span className="sf-reel"><Play size={13} fill="#fff" /></span>}
                  </div>

                  <div className="sf-body">
                    {hasStats && (
                      <div className="sf-stats">
                        <span><Heart size={17} /> {fmtCount(item.likes)}</span>
                        <span><MessageCircle size={17} /> {fmtCount(item.comments)}</span>
                      </div>
                    )}
                    {item.title && <p className="sf-cap">{item.title}</p>}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Arrows */}
          {items.length > 1 && (
            <div className="sf-nav">
              <button onClick={() => scrollByCard(-1)} aria-label="Previous"><ChevronLeft size={20} /></button>
              <button onClick={() => scrollByCard(1)} aria-label="Next"><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .sf { background: #fff; }
        .sf-wrap { max-width: 1400px; margin: 0 auto; padding: 36px 24px 44px; }
        .sf-panel { position: relative; border: 1px solid #fbcaa6; border-radius: 18px; padding: 30px 22px 22px;
          background: linear-gradient(180deg, #fff 0%, #fff8f2 100%); }
        .sf-pill { position: absolute; top: -15px; left: 26px; background: #f97316; color: #fff;
          font-size: 13px; font-weight: 800; letter-spacing: .02em; padding: 7px 16px; border-radius: 999px;
          box-shadow: 0 6px 16px rgba(249,115,22,.32); }

        .sf-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
        .sf-kicker { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #f97316; }
        .sf-title { margin: 5px 0 0; font-size: clamp(19px, 2.6vw, 26px); font-weight: 800; color: #131921; font-family: 'Syne', sans-serif; }
        .sf-socials { display: flex; gap: 8px; }
        .sf-social { font-size: 12px; font-weight: 700; color: #131921; background: #fff; border: 1px solid #e4e7ec;
          padding: 7px 14px; border-radius: 999px; text-decoration: none; transition: all .15s; }
        .sf-social:hover { border-color: #f97316; color: #f97316; }

        .sf-track { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory;
          padding-bottom: 6px; scrollbar-width: none; }
        .sf-track::-webkit-scrollbar { display: none; }

        .sf-card { flex: 0 0 clamp(240px, 19vw, 288px); scroll-snap-align: start; background: #fff;
          border: 1px solid #ececf0; border-radius: 12px; overflow: hidden; cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,.05); transition: transform .18s, box-shadow .18s; text-align: left; }
        .sf-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,.13); }

        .sf-card-head { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; }
        .sf-id { display: flex; flex-direction: column; min-width: 0; }
        .sf-handle { font-size: 13.5px; font-weight: 700; color: #131921; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sf-date { font-size: 11px; color: #8b8f98; margin-top: 1px; }
        .sf-plat { color: #131921; flex-shrink: 0; }

        .sf-media { position: relative; width: 100%; aspect-ratio: 1 / 1; background: #f0f2f5; }
        .sf-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sf-fallback { position: absolute; inset: 0; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: #fff; text-align: center; padding: 14px; }
        .sf-fallback-label { font-size: 12px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sf-reel { position: absolute; top: 9px; right: 9px; width: 26px; height: 26px; border-radius: 7px;
          background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; color: #fff; }

        .sf-body { padding: 11px 13px 14px; }
        .sf-stats { display: flex; gap: 16px; margin-bottom: 8px; }
        .sf-stats span { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: #1f2430; }
        .sf-stats svg { color: #6b7280; }
        .sf-cap { margin: 0; font-size: 12.5px; line-height: 1.45; color: #4b5159;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

        .sf-nav { display: flex; justify-content: center; gap: 12px; margin-top: 18px; }
        .sf-nav button { width: 44px; height: 38px; border-radius: 10px; border: 1px solid #e4e7ec; background: #fff;
          color: #131921; display: flex; align-items: center; justify-content: center; cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,.06); transition: all .15s; }
        .sf-nav button:hover { border-color: #f97316; color: #f97316; }

        @media (max-width: 640px) {
          .sf-wrap { padding: 26px 12px 34px; }
          .sf-panel { padding: 26px 14px 18px; }
          .sf-card { flex: 0 0 78vw; }
        }
      `}</style>
    </section>
  );
}
