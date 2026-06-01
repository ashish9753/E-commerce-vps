import { useState, useEffect } from 'react';
import { mediaApi } from '../../api/media';
import { C } from '../../theme/dashboardTheme';
import { isHttpUrl } from '../../utils/imageUrl';
import { detectMedia, mediaThumbnail, PLATFORM, isVideoType } from '../../utils/media';

const emptyDraft = { url: '', title: '', thumbnail: '', position: 0, isActive: true };

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>
        {label}{hint && <span style={{ fontWeight:400, textTransform:'none', color:C.sub, marginLeft:6 }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inpStyle = () => ({
  width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px',
  fontSize:13, outline:'none', background:C.bg, color:C.text, boxSizing:'border-box', fontFamily:'inherit',
});

const fireToast = (message, type = 'warn') =>
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));

// A single square tile preview (matches the storefront look).
function Tile({ item, size = 120 }) {
  const thumb = mediaThumbnail(item);
  const plat = PLATFORM[detectMedia(item.url).type] || PLATFORM.link;
  return (
    <div style={{ position:'relative', width:size, height:size, borderRadius:10, overflow:'hidden', background:'#e9edf2', flexShrink:0 }}>
      {thumb ? (
        <img src={thumb} alt={item.title || plat.label} style={{ width:'100%', height:'100%', objectFit:'cover' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
      ) : null}
      <span style={{ display: thumb ? 'none' : 'flex', position:'absolute', inset:0, flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:6, background:plat.color, color:'#fff', textAlign:'center', padding:6 }}>
        <span style={{ fontSize:22, lineHeight:1 }}>{plat.icon}</span>
        <span style={{ fontSize:10, fontWeight:700, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title || plat.label}</span>
      </span>
      {isVideoType(detectMedia(item.url).type) && (
        <span style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:30, height:30,
          borderRadius:'50%', background:'rgba(0,0,0,.55)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, paddingLeft:2 }}>▶</span>
      )}
      <span style={{ position:'absolute', top:6, left:6, fontSize:8, fontWeight:800, letterSpacing:'.04em', color:'#fff',
        background:plat.color, padding:'2px 6px', borderRadius:5, textTransform:'uppercase' }}>{plat.label}</span>
    </div>
  );
}

export default function AdminMediaTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const load = () => {
    setLoading(true);
    mediaApi.getAll()
      .then(r => setItems(r.data?.data?.media || []))
      .catch(() => fireToast('Failed to load media', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setDraft(emptyDraft); setEditingId(null); };

  const startEdit = (m) => {
    setEditingId(m._id);
    setDraft({
      url: m.url || '', title: m.title || '', thumbnail: m.thumbnail || '',
      position: m.position ?? 0, isActive: m.isActive !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isHttpUrl(draft.url)) { fireToast('Paste a full link starting with http:// or https://'); return; }
    if (draft.thumbnail.trim() && !isHttpUrl(draft.thumbnail)) { fireToast('That thumbnail URL looks invalid'); return; }
    setSaving(true);
    try {
      const body = {
        url: draft.url.trim(),
        title: draft.title.trim(),
        thumbnail: draft.thumbnail.trim(),
        position: Number(draft.position) || 0,
        isActive: draft.isActive,
      };
      if (editingId) await mediaApi.update(editingId, body);
      else           await mediaApi.create(body);
      resetForm();
      load();
    } catch (err) {
      fireToast(err.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this item from the highlights strip?')) return;
    try { await mediaApi.remove(id); if (editingId === id) resetForm(); load(); }
    catch (err) { fireToast(err.response?.data?.message || 'Failed to delete', 'error'); }
  };

  const toggleActive = async (m) => {
    try { await mediaApi.update(m._id, { isActive: !m.isActive }); load(); }
    catch (err) { fireToast(err.response?.data?.message || 'Failed to toggle', 'error'); }
  };

  // Live preview uses the current draft (derives thumbnail/type from the url).
  const previewItem = { url: draft.url, title: draft.title, thumbnail: draft.thumbnail };
  const detected = detectMedia(draft.url);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.line}`, padding:22 }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:16, color:C.text, marginBottom:6 }}>
          {editingId ? '✏️ Edit Highlight' : '➕ Add Highlight'}
        </div>
        <div style={{ fontSize:12, color:C.mute, marginBottom:16 }}>
          Paste any link — Google Drive, Instagram, Facebook, TikTok, YouTube, or a direct image/video URL.
          It shows as a thumbnail above the site footer and opens the link in a new tab when clicked.
        </div>

        <form onSubmit={submit} style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:16, alignItems:'start' }}>
          {/* Live preview tile */}
          <Tile item={previewItem} />

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <Field label="Media Link *" hint="the page/post/video that opens on click">
                <input value={draft.url} onChange={e => set('url', e.target.value)}
                  placeholder="https://www.instagram.com/p/…  or  https://drive.google.com/file/d/…" style={inpStyle()} required />
              </Field>
              {draft.url && (
                <div style={{ fontSize:11, color:C.mute, marginTop:5 }}>
                  Detected: <b style={{ color:C.text }}>{(PLATFORM[detected.type] || PLATFORM.link).label}</b>
                  {!detected.thumbnail && !draft.thumbnail.trim() && ' — no auto thumbnail, add a Thumbnail URL below for a nicer tile.'}
                </div>
              )}
            </div>

            <Field label="Title / Caption" hint="optional">
              <input value={draft.title} onChange={e => set('title', e.target.value)} placeholder="New store opening 🎉" style={inpStyle()} />
            </Field>
            <Field label="Display Order" hint="lower shows first">
              <input type="number" value={draft.position} onChange={e => set('position', e.target.value)} placeholder="0" style={inpStyle()} />
            </Field>

            <div style={{ gridColumn:'1/-1' }}>
              <Field label="Thumbnail URL" hint="optional — needed for Instagram/Facebook/TikTok/video links; Drive & YouTube auto-fill">
                <input value={draft.thumbnail} onChange={e => set('thumbnail', e.target.value)}
                  placeholder="https://drive.google.com/file/d/…  (or any image link)" style={inpStyle()} />
              </Field>
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>Status</label>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8, background:C.bg, border:`1px solid ${C.line}`, cursor:'pointer', fontSize:13, color:C.text }}>
                <input type="checkbox" checked={draft.isActive} onChange={e => set('isActive', e.target.checked)} />
                Active (visible on storefront)
              </label>
            </div>

            <div style={{ gridColumn:'1/-1', display:'flex', gap:10, marginTop:6 }}>
              <button type="submit" disabled={saving}
                style={{ padding:'10px 22px', borderRadius:8, background:C.accent, color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Highlight'}
              </button>
              <button type="button" onClick={resetForm}
                style={{ padding:'10px 18px', borderRadius:8, background:C.card2, border:`1px solid ${C.line}`, color:C.sub, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                {editingId ? 'Cancel Edit' : 'Reset'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.line}`, padding:22 }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:16, color:C.text, marginBottom:14 }}>
          Highlights ({items.length})
        </div>
        {loading ? (
          <div style={{ padding:'30px', textAlign:'center', color:C.mute }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding:'30px', textAlign:'center', color:C.mute, fontSize:13 }}>No highlights yet — add your first above.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {items.map(m => (
              <div key={m._id} style={{ display:'grid', gridTemplateColumns:'90px 1fr auto', gap:14, padding:12, border:`1px solid ${C.line}`, borderRadius:10, background:C.bg, opacity: m.isActive ? 1 : 0.55, alignItems:'center' }}>
                <Tile item={m} size={90} />
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{m.title || (PLATFORM[m.type] || PLATFORM.link).label}</div>
                  <a href={m.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:12, color:'#818cf8', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{m.url}</a>
                  <div style={{ fontSize:11, color:C.mute, marginTop:4 }}>Order: {m.position ?? 0}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={() => startEdit(m)} style={{ padding:'6px 14px', borderRadius:6, background:'rgba(99,102,241,.12)', color:'#818cf8', border:'1px solid rgba(99,102,241,.3)', fontSize:12, fontWeight:600, cursor:'pointer' }}>Edit</button>
                  <button onClick={() => toggleActive(m)} style={{ padding:'6px 14px', borderRadius:6, background:C.card2, color:m.isActive ? C.yellow : C.green, border:`1px solid ${m.isActive ? C.yellow : C.green}40`, fontSize:12, fontWeight:600, cursor:'pointer' }}>{m.isActive ? 'Hide' : 'Show'}</button>
                  <button onClick={() => remove(m._id)} style={{ padding:'6px 14px', borderRadius:6, background:C.red+'18', color:C.red, border:`1px solid ${C.red}44`, fontSize:12, fontWeight:600, cursor:'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
