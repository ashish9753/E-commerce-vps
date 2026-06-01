import { useEffect, useState } from 'react';
import { mediaApi } from '../../api/media';
import { mediaThumbnail, PLATFORM, isVideoType } from '../../utils/media';

// Social-profile handles (kept in sync with Footer.jsx).
const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/trade_ngine' },
  { label: 'Facebook',  href: 'https://www.facebook.com/tradengin' },
  { label: 'TikTok',    href: 'https://www.tiktok.com/@tradengine' },
];

export default function SocialShowcase() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    mediaApi.getActive()
      .then(({ data }) => { if (alive) setItems(data.data?.media || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!items.length) return null;

  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <section className="ssw">
      <div className="ssw-wrap">
        <div className="ssw-head">
          <div>
            <div className="ssw-kicker">Follow our journey</div>
            <h2 className="ssw-title">Events, launches & behind the scenes</h2>
          </div>
          <div className="ssw-socials">
            {SOCIALS.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="ssw-social">
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <div className="ssw-grid">
          {items.map(item => {
            const thumb = mediaThumbnail(item);
            const plat = PLATFORM[item.type] || PLATFORM.link;
            return (
              <button
                key={item._id}
                className="ssw-tile"
                onClick={() => open(item.url)}
                title={item.title || plat.label}
                aria-label={item.title || `Open ${plat.label} post`}
              >
                {thumb ? (
                  <img src={thumb} alt={item.title || plat.label} loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                ) : null}
                {/* Fallback card (no thumbnail): platform-colored with its icon. */}
                <span className="ssw-fallback" style={{ display: thumb ? 'none' : 'flex', background: plat.color }}>
                  <span className="ssw-fallback-icon">{plat.icon}</span>
                  <span className="ssw-fallback-label">{item.title || plat.label}</span>
                </span>

                {/* Play badge for videos. */}
                {isVideoType(item.type) && <span className="ssw-play">▶</span>}
                {/* Platform badge. */}
                <span className="ssw-badge" style={{ background: plat.color }}>{plat.label}</span>
                {/* Caption on hover (desktop). */}
                {item.title && <span className="ssw-caption">{item.title}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        .ssw { background: #f7f8fa; border-top: 1px solid #eceef2; }
        .ssw-wrap { max-width: 1400px; margin: 0 auto; padding: 40px 24px 48px; }
        .ssw-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
        .ssw-kicker { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #f97316; }
        .ssw-title { margin: 6px 0 0; font-size: clamp(20px, 3vw, 28px); font-weight: 800; color: #131921; font-family: 'Syne', sans-serif; }
        .ssw-socials { display: flex; gap: 8px; }
        .ssw-social { font-size: 12px; font-weight: 700; color: #131921; background: #fff; border: 1px solid #e4e7ec;
          padding: 7px 14px; border-radius: 999px; text-decoration: none; transition: all .15s; }
        .ssw-social:hover { border-color: #f97316; color: #f97316; }

        .ssw-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
        .ssw-tile { position: relative; aspect-ratio: 1 / 1; border: 0; padding: 0; cursor: pointer; border-radius: 14px;
          overflow: hidden; background: #e9edf2; box-shadow: 0 1px 3px rgba(0,0,0,.06); transition: transform .2s, box-shadow .2s; }
        .ssw-tile:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(0,0,0,.16); }
        .ssw-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .ssw-fallback { position: absolute; inset: 0; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; color: #fff; text-align: center; padding: 10px; }
        .ssw-fallback-icon { font-size: 30px; line-height: 1; }
        .ssw-fallback-label { font-size: 12px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .ssw-play { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 16px; padding-left: 3px; pointer-events: none; }
        .ssw-badge { position: absolute; top: 8px; left: 8px; font-size: 9px; font-weight: 800; letter-spacing: .04em;
          color: #fff; padding: 3px 7px; border-radius: 6px; text-transform: uppercase; opacity: .92; }
        .ssw-caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 10px 8px; color: #fff; font-size: 11px;
          font-weight: 600; text-align: left; line-height: 1.3; opacity: 0; transition: opacity .2s;
          background: linear-gradient(to top, rgba(0,0,0,.72), transparent);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ssw-tile:hover .ssw-caption { opacity: 1; }

        @media (max-width: 1024px) { .ssw-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 640px) {
          .ssw-wrap { padding: 28px 14px 34px; }
          .ssw-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .ssw-tile { border-radius: 10px; }
          .ssw-caption { display: none; }
        }
      `}</style>
    </section>
  );
}
