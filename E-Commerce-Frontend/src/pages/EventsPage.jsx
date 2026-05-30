import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/catalog';

const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const daysBetween = (a, b) => Math.ceil((new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24));

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    eventsApi.getAll()
      .then((res) => { if (!cancelled) setEvents(res.data?.data?.events || []); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const { active, upcoming, past } = useMemo(() => {
    const now = Date.now();
    const a = [], u = [], p = [];
    for (const ev of events) {
      const start = new Date(ev.startDate).getTime();
      const end   = new Date(ev.endDate).getTime();
      if (ev.isActive === false) { p.push(ev); continue; }
      if (now >= start && now <= end) a.push(ev);
      else if (now < start) u.push(ev);
      else p.push(ev);
    }
    a.sort((x, y) => new Date(x.endDate) - new Date(y.endDate));      // ending soonest first
    u.sort((x, y) => new Date(x.startDate) - new Date(y.startDate));  // starting soonest first
    p.sort((x, y) => new Date(y.endDate) - new Date(x.endDate));      // most recent past first
    return { active: a, upcoming: u, past: p };
  }, [events]);

  const openEvent = (ev) => {
    // No dedicated event-detail page yet — drop the user into the products
    // list filtered to sale items so they can shop the event right away.
    // If the event has a linked coupon code we put it in the URL too so the
    // products page (and later the cart) can surface it.
    const params = new URLSearchParams({ onSale: 'true', sort: 'newest' });
    if (ev.badge) params.set('event', ev.badge);
    if (ev.coupon?.code) params.set('coupon', ev.coupon.code);
    navigate(`/products?${params.toString()}`);
  };

  return (
    <div className="wrap">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-soft py-6">
        <a className="text-mute font-medium cursor-pointer hover:text-ink" onClick={() => navigate('/')}>Home</a>
        <span>›</span>
        <span className="text-ink font-semibold">Events &amp; Offers</span>
      </div>

      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold text-ink leading-tight">Events &amp; Offers</h1>
        <p className="text-mute text-sm mt-1">Running promotions and what&apos;s coming up next.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-5 pb-20 max-md:grid-cols-2 max-sm:grid-cols-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse h-[220px] bg-surface rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-[60px]">🎉</div>
          <p className="text-mute mt-2">No events scheduled yet. Check back soon!</p>
        </div>
      ) : (
        <div className="pb-20 space-y-12">
          <Section
            title="Happening Now"
            emoji="🔥"
            tone="active"
            empty="No events running right now."
            events={active}
            onOpen={openEvent}
            badgeFor={(ev) => {
              const days = daysBetween(ev.endDate, Date.now());
              if (days <= 0) return 'Ends today';
              if (days === 1) return 'Ends tomorrow';
              return `Ends in ${days} days`;
            }}
          />
          <Section
            title="Coming Soon"
            emoji="🗓️"
            tone="upcoming"
            empty="Nothing scheduled yet."
            events={upcoming}
            onOpen={null}
            badgeFor={(ev) => {
              const days = daysBetween(ev.startDate, Date.now());
              if (days <= 1) return 'Starts tomorrow';
              return `Starts in ${days} days`;
            }}
          />
          {past.length > 0 && (
            <Section
              title="Past Events"
              emoji="🕘"
              tone="past"
              empty=""
              events={past.slice(0, 6)}
              onOpen={null}
              badgeFor={(ev) => `Ended ${fmtDate(ev.endDate)}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, emoji, tone, events, empty, onOpen, badgeFor }) {
  if (events.length === 0 && !empty) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-xl font-extrabold text-ink">{emoji} {title}</div>
        <div className="h-px bg-line-2 flex-1" />
        <div className="text-xs text-mute">{events.length} event{events.length === 1 ? '' : 's'}</div>
      </div>
      {events.length === 0 ? (
        <div className="text-sm text-mute italic py-4">{empty}</div>
      ) : (
        <div className="grid grid-cols-3 gap-5 max-md:grid-cols-2 max-sm:grid-cols-1">
          {events.map((ev) => (
            <EventCard
              key={ev._id}
              ev={ev}
              tone={tone}
              badge={badgeFor?.(ev)}
              onOpen={onOpen ? () => onOpen(ev) : null}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({ ev, tone, badge, onOpen }) {
  const clickable = !!onOpen;
  return (
    <div
      onClick={onOpen || undefined}
      className={[
        'rounded-2xl border overflow-hidden transition-all bg-white',
        tone === 'active'   ? 'border-accent/40 shadow-md' : 'border-line-2',
        tone === 'past'     ? 'opacity-70' : '',
        clickable           ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : '',
      ].join(' ')}
    >
      <div className="relative aspect-[16/9] bg-surface">
        {ev.image ? (
          <img src={ev.image} alt={ev.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🎉</div>
        )}
        {ev.discountPercent > 0 && (
          <div className="absolute top-3 left-3 bg-accent text-white text-xs font-extrabold px-2.5 py-1 rounded-full">
            {ev.discountPercent}% OFF
          </div>
        )}
        {badge && (
          <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
            {badge}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-ink leading-snug line-clamp-2">{ev.name}</h3>
          {ev.badge && (
            <span className="text-[10px] font-extrabold text-accent bg-accent/10 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
              {ev.badge}
            </span>
          )}
        </div>
        {ev.description && (
          <p className="text-xs text-mute mt-2 line-clamp-2">{ev.description}</p>
        )}
        <div className="text-[11px] text-mute mt-3 flex items-center gap-1">
          <span>📅</span>
          <span>{fmtDate(ev.startDate)} – {fmtDate(ev.endDate)}</span>
        </div>
        {ev.coupon?.code && tone === 'active' && (
          <div className="mt-3 flex items-center justify-between gap-2 bg-surface rounded-lg px-3 py-2">
            <span className="text-[11px] text-mute">Use code</span>
            <span className="text-[12px] font-extrabold text-ink tracking-wider">{ev.coupon.code}</span>
          </div>
        )}
        {clickable && (
          <button className="btn btn-accent btn-sm w-full mt-3" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            Shop this event →
          </button>
        )}
      </div>
    </div>
  );
}
