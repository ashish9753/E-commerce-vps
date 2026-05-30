/**
 * Visual order-status pipeline — matches the Return Requests style (green=done,
 * orange=current, grey=upcoming). Used inside the expanded order card on the
 * admin + employee dashboards so staff can see fulfilment progress at a glance.
 *
 * `theme` accepts colour tokens from whichever dashboard renders it so the
 * pipeline blends in regardless of dark/light surface.
 *
 * `onAdvance(nextStatus)` is optional — when provided, the next step becomes
 * clickable, letting staff move the order forward without leaving the card.
 */
const PIPELINE = ['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED'];
const LABELS = {
  PLACED:           'Placed',
  CONFIRMED:        'Confirmed',
  PACKED:           'Ready to Ship',
  SHIPPED:          'Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED:        'Delivered',
};

// Only PLACED → CONFIRMED is an employee action.
// Everything after CONFIRMED is updated automatically by Upaya.
const EMPLOYEE_ACTIONABLE = ['PLACED'];

export default function OrderPipeline({ status, onAdvance, busy = false, theme }) {
  const t = {
    line:   '#2a3441',
    accent: '#f97316',
    green:  '#22c55e',
    red:    '#ef4444',
    mute:   '#94a3b8',
    text:   '#e2e8f0',
    bg:     '#0f1623',
    card2:  '#1a2332',
    ...theme,
  };

  // Special terminal states — no pipeline, just a single status pill.
  if (status === 'CANCELLED' || status === 'RETURNED') {
    const isCancel = status === 'CANCELLED';
    return (
      <div style={{ padding:'14px 18px', borderTop:`1px solid ${t.line}`, background:t.bg }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:24, height:24, borderRadius:'50%',
            background: isCancel ? t.red : t.mute,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'white', fontSize:14, fontWeight:800,
          }}>✕</div>
          <div style={{ fontSize:13, fontWeight:700, color: isCancel ? t.red : t.mute }}>
            Order {isCancel ? 'cancelled' : 'returned'} — fulfilment ended
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = PIPELINE.indexOf(status);
  if (currentIdx < 0) return null; // unknown status

  return (
    <div style={{ padding:'12px 18px', borderTop:`1px solid ${t.line}`, background:t.bg }}>
      <div style={{ display:'flex', alignItems:'center' }}>
        {PIPELINE.map((step, i) => {
          const done   = i < currentIdx;
          const active = i === currentIdx;
          const nextStep = i === currentIdx + 1;
          const clickable = nextStep && typeof onAdvance === 'function' && !busy
            && EMPLOYEE_ACTIONABLE.includes(status);
          const col = done ? t.green : active ? t.accent : t.line;
          return (
            <div key={step} style={{ display:'flex', alignItems:'center', flex: i < PIPELINE.length-1 ? 1 : 'none' }}>
              <div
                onClick={clickable ? () => onAdvance(step) : undefined}
                title={clickable ? `Advance to ${LABELS[step]}` : undefined}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  cursor: clickable ? 'pointer' : 'default',
                  opacity: busy ? 0.6 : 1,
                }}>
                <div style={{
                  width:24, height:24, borderRadius:'50%',
                  background: done ? t.green : active ? t.accent : t.card2,
                  border:`2px solid ${col}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, color: done || active ? 'white' : t.mute, fontWeight:800,
                  boxShadow: clickable ? `0 0 0 3px ${t.accent}22` : 'none',
                }}>
                  {done ? '✓' : i+1}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color: active ? t.accent : done ? t.green : t.mute, whiteSpace:'nowrap' }}>
                  {LABELS[step]}
                </div>
              </div>
              {i < PIPELINE.length-1 && (
                <div style={{ flex:1, height:2, background: done ? t.green : t.line, margin:'0 6px', marginBottom:14 }} />
              )}
            </div>
          );
        })}
      </div>
      {typeof onAdvance === 'function' && EMPLOYEE_ACTIONABLE.includes(status) && currentIdx < PIPELINE.length - 1 && (
        <div style={{ fontSize:10, color:t.mute, marginTop:6, textAlign:'center' }}>
          Click <strong style={{ color:t.accent }}>Confirmed</strong> to approve this order
        </div>
      )}
      {currentIdx >= 1 && currentIdx < PIPELINE.length - 1 && (
        <div style={{ fontSize:10, color:t.mute, marginTop:6, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
          <span>🚚</span> Remaining steps updated automatically by <strong style={{ color:'#94a3b8' }}>Upaya</strong>
        </div>
      )}
    </div>
  );
}

export { PIPELINE as ORDER_PIPELINE, LABELS as ORDER_PIPELINE_LABELS };
