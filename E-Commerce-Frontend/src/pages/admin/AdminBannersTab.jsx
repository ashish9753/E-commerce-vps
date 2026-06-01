import { useState, useEffect, useRef } from 'react';
import { bannersApi } from '../../api/banners';
import { productsApi } from '../../api/products';
import { C } from '../../theme/dashboardTheme';
import { isHttpUrl, toDirectImageUrl } from '../../utils/imageUrl';

const POSITIONS = [
  { v: 'left',   label: '⬅ Left' },
  { v: 'center', label: '⬛ Center' },
  { v: 'right',  label: 'Right ➡' },
];

const FONT_FAMILIES = [
  'Syne',
  'DM Sans',
  'Georgia',
  'Times New Roman',
  'Arial',
  'Helvetica',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Impact',
];

const FONT_WEIGHTS = [
  { v: '400', label: 'Regular (400)' },
  { v: '500', label: 'Medium (500)' },
  { v: '600', label: 'Semibold (600)' },
  { v: '700', label: 'Bold (700)' },
  { v: '800', label: 'Extrabold (800)' },
  { v: '900', label: 'Black (900)' },
];

const emptyDraft = {
  title: '', subtitle: '', overlayText: '', ctaLabel: 'Shop Now',
  textColor: '#ffffff', textPosition: 'left',
  fontFamily: 'Syne', fontSize: 48, fontWeight: '800', fontStyle: 'normal',
  link: '', product: '',
  imageUrl: '',
  position: 0, isActive: true,
  startDate: '', endDate: '',
};

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

/* Build fresh each call so theme changes apply immediately. */
const inpStyle = () => ({
  width:'100%', height:36, border:`1px solid ${C.line}`, borderRadius:8, padding:'0 12px',
  fontSize:13, outline:'none', background:C.bg, color:C.text, boxSizing:'border-box', fontFamily:'inherit',
});

function BannerPreview({ draft, imagePreview }) {
  const align = draft.textPosition === 'center' ? 'center' : draft.textPosition === 'right' ? 'flex-end' : 'flex-start';
  const textAlign = draft.textPosition;
  return (
    <div style={{
      position:'relative', width:'100%', aspectRatio:'3 / 1', borderRadius:12, overflow:'hidden',
      background: imagePreview ? '#000' : 'linear-gradient(135deg, #1f2937, #0d0f14)',
      border:`1px solid ${C.line}`,
    }}>
      {imagePreview && (
        <img src={imagePreview} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
      )}
      <div style={{
        position:'relative', height:'100%', display:'flex', flexDirection:'column', justifyContent:'center',
        alignItems: align, padding:'24px 36px', color: draft.textColor, textShadow:'0 2px 8px rgba(0,0,0,.55)',
        textAlign,
        fontFamily: `'${draft.fontFamily}', sans-serif`,
        fontStyle: draft.fontStyle,
      }}>
        {draft.overlayText && <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', opacity:.9 }}>{draft.overlayText}</div>}
        {draft.title && (
          <div style={{
            fontSize: Math.max(14, Math.min(60, (Number(draft.fontSize) || 48) * 0.55)),
            fontWeight: draft.fontWeight,
            fontFamily: `'${draft.fontFamily}', sans-serif`,
            fontStyle: draft.fontStyle,
            lineHeight: 1.05, marginTop: 6,
          }}>{draft.title}</div>
        )}
        {draft.subtitle && <div style={{ fontSize:14, fontWeight:500, marginTop:6, maxWidth:380, opacity:.95 }}>{draft.subtitle}</div>}
        {draft.ctaLabel && (
          <button type="button" style={{
            marginTop:14, padding:'8px 18px', borderRadius:6, background:C.accent, color:'white',
            border:'none', fontWeight:700, fontSize:13, cursor:'pointer',
          }}>
            {draft.ctaLabel} ›
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminBannersTab() {
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingExistingImage, setEditingExistingImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const load = () => {
    setLoading(true);
    bannersApi.getAll()
      .then(r => setBanners(r.data?.data?.banners || []))
      .catch(() => setError('Failed to load banners'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    productsApi.getAll({ limit: 200 })
      .then(r => setProducts(r.data?.data?.data || r.data?.data?.products || []))
      .catch(() => {});
  }, []);

  const onPickFile = (f) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setFilePreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const resetForm = () => {
    setDraft(emptyDraft);
    setFile(null);
    setFilePreview(null);
    setEditingId(null);
    setEditingExistingImage(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const startEdit = (b) => {
    setEditingId(b._id);
    setEditingExistingImage(b.image);
    setFile(null);
    setFilePreview(null);
    setDraft({
      title:        b.title || '',
      subtitle:     b.subtitle || '',
      overlayText:  b.overlayText || '',
      ctaLabel:     b.ctaLabel || 'Shop Now',
      textColor:    b.textColor || '#ffffff',
      textPosition: b.textPosition || 'left',
      fontFamily:   b.fontFamily || 'Syne',
      fontSize:     b.fontSize ?? 48,
      fontWeight:   b.fontWeight || '800',
      fontStyle:    b.fontStyle || 'normal',
      link:         b.link || '',
      product:      b.product?._id || b.product || '',
      // If this banner's image is an external link (no Cloudinary id), show it
      // in the URL field so it can be edited in place.
      imageUrl:     b.imagePublicId ? '' : (b.image || ''),
      position:     b.position ?? 0,
      isActive:     b.isActive !== false,
      startDate:    b.startDate ? new Date(b.startDate).toISOString().slice(0,10) : '',
      endDate:      b.endDate ? new Date(b.endDate).toISOString().slice(0,10) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fireToast = (message, type = 'warn') =>
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // Nothing is mandatory. Only guard against a clearly malformed URL the user
    // actually typed — an empty form is allowed to submit.
    if (draft.imageUrl.trim() && !file && !isHttpUrl(draft.imageUrl)) {
      fireToast('That image URL looks invalid — use a full http(s) link'); return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(draft).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        if (k === 'isActive') fd.append(k, v ? 'true' : 'false');
        else if (typeof v === 'boolean') fd.append(k, v ? 'true' : 'false');
        else if (v !== '') fd.append(k, v);
        else if (editingId && (k === 'product' || k === 'link')) fd.append(k, ''); // explicit clear
      });
      if (file) fd.append('image', file);

      if (editingId) await bannersApi.update(editingId, fd);
      else           await bannersApi.create(fd);

      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this banner? The image will also be removed from storage.')) return;
    try {
      await bannersApi.remove(id);
      if (editingId === id) resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete banner');
    }
  };

  const toggleActive = async (b) => {
    const fd = new FormData();
    fd.append('isActive', b.isActive ? 'false' : 'true');
    try { await bannersApi.update(b._id, fd); load(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to toggle banner'); }
  };

  const previewImage = filePreview || (isHttpUrl(draft.imageUrl) ? toDirectImageUrl(draft.imageUrl) : null) || editingExistingImage;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.line}`, padding:22 }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:16, color:C.text, marginBottom:18 }}>
          {editingId ? '✏️ Edit Banner' : '➕ Create Banner'}
        </div>

        <BannerPreview draft={draft} imagePreview={previewImage} />

        {/* Errors surface as the global bottom-right toast — no inline bar */}

        <form onSubmit={submit} style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <Field label="Banner Image" hint="JPEG/PNG/WebP, max 2 MB. Recommended ~1200×400">
              <div
                onClick={() => fileRef.current?.click()}
                style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 12px', border:`1px dashed ${C.line}`, borderRadius:8, cursor:'pointer', background:C.bg }}
              >
                <span style={{ padding:'6px 14px', borderRadius:6, background:C.accent+'18', border:`1px solid ${C.accent}44`, color:C.accent, fontSize:12, fontWeight:700 }}>
                  Choose file
                </span>
                <span style={{ fontSize:12, color:C.mute }}>
                  {file ? file.name : editingExistingImage ? 'Current image will be kept (pick a new one to replace)' : 'No file chosen'}
                </span>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => onPickFile(e.target.files?.[0])} />
              </div>
            </Field>
            <div style={{ marginTop:10 }}>
              <Field label="Or Image URL" hint="paste a hosted image link instead of uploading — saves storage">
                <input
                  value={draft.imageUrl}
                  onChange={e => set('imageUrl', e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  style={inpStyle()}
                />
              </Field>
              {file && draft.imageUrl.trim() && (
                <div style={{ fontSize:11, color:C.mute, marginTop:5 }}>
                  An uploaded file is selected — it will be used instead of the URL. Remove the file to use the URL.
                </div>
              )}
            </div>
          </div>

          <Field label="Title">
            <input value={draft.title} onChange={e => set('title', e.target.value)} placeholder="Big Tech Carnival" style={inpStyle()} />
          </Field>
          <Field label="Subtitle" hint="optional, shown under the title">
            <input value={draft.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Smartphones & audio essentials" style={inpStyle()} />
          </Field>

          <Field label="Overlay Tag" hint="like 'Min 40% Off' shown above the title">
            <input value={draft.overlayText} onChange={e => set('overlayText', e.target.value)} placeholder="Min 40% Off" style={inpStyle()} />
          </Field>
          <Field label="CTA Button Label">
            <input value={draft.ctaLabel} onChange={e => set('ctaLabel', e.target.value)} placeholder="Shop Now" style={inpStyle()} />
          </Field>

          <Field label="Text Color">
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="color" value={draft.textColor} onChange={e => set('textColor', e.target.value)} style={{ width:46, height:36, border:`1px solid ${C.line}`, borderRadius:6, background:C.bg, cursor:'pointer', padding:2 }} />
              <input value={draft.textColor} onChange={e => set('textColor', e.target.value)} style={{ ...inpStyle(), flex:1, fontFamily:'monospace' }} />
            </div>
          </Field>
          <Field label="Text Position">
            <select value={draft.textPosition} onChange={e => set('textPosition', e.target.value)} style={{ ...inpStyle(), cursor:'pointer' }}>
              {POSITIONS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </Field>

          <Field label="Font Family">
            <select value={draft.fontFamily} onChange={e => set('fontFamily', e.target.value)}
              style={{ ...inpStyle(), cursor:'pointer', fontFamily: `'${draft.fontFamily}', sans-serif` }}>
              {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>)}
            </select>
          </Field>
          <Field label="Font Weight">
            <select value={draft.fontWeight} onChange={e => set('fontWeight', e.target.value)} style={{ ...inpStyle(), cursor:'pointer' }}>
              {FONT_WEIGHTS.map(w => <option key={w.v} value={w.v}>{w.label}</option>)}
            </select>
          </Field>

          <Field label="Font Size (px)" hint="12 – 120">
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="range" min="12" max="120" value={draft.fontSize}
                onChange={e => set('fontSize', Number(e.target.value))}
                style={{ flex:1, accentColor: C.accent }} />
              <input type="number" min="12" max="120" value={draft.fontSize}
                onChange={e => set('fontSize', Number(e.target.value) || 48)}
                style={{ ...inpStyle(), width:80 }} />
            </div>
          </Field>
          <Field label="Font Style">
            <div style={{ display:'flex', gap:8 }}>
              {[
                { v: 'normal', label: 'Normal' },
                { v: 'italic', label: 'Italic' },
              ].map(s => (
                <button key={s.v} type="button" onClick={() => set('fontStyle', s.v)}
                  style={{ flex:1, height:36, borderRadius:8, border:`1px solid ${draft.fontStyle === s.v ? C.accent : C.line}`,
                    background: draft.fontStyle === s.v ? C.accent : C.bg,
                    color: draft.fontStyle === s.v ? 'white' : C.text,
                    fontWeight:600, fontSize:13, cursor:'pointer', fontStyle: s.v }}>
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Linked Product" hint="banner click jumps to this product">
            <select value={draft.product} onChange={e => set('product', e.target.value)} style={{ ...inpStyle(), cursor:'pointer' }}>
              <option value="">— No product —</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Or Custom Link URL" hint="used when no product is selected">
            <input value={draft.link} onChange={e => set('link', e.target.value)} placeholder="/products?category=Electronics" style={inpStyle()} />
          </Field>

          <Field label="Display Order">
            <input type="number" value={draft.position} onChange={e => set('position', e.target.value)} placeholder="0" style={inpStyle()} />
          </Field>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.mute, marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' }}>Status</label>
            <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8, background:C.bg, border:`1px solid ${C.line}`, cursor:'pointer', fontSize:13, color:C.text }}>
              <input type="checkbox" checked={draft.isActive} onChange={e => set('isActive', e.target.checked)} />
              Active (visible on storefront)
            </label>
          </div>

          <Field label="Start Date" hint="optional schedule">
            <input type="date" value={draft.startDate} onChange={e => set('startDate', e.target.value)} style={inpStyle()} />
          </Field>
          <Field label="End Date" hint="optional schedule">
            <input type="date" value={draft.endDate} onChange={e => set('endDate', e.target.value)} style={inpStyle()} />
          </Field>

          <div style={{ gridColumn:'1/-1', display:'flex', gap:10, marginTop:6 }}>
            <button type="submit" disabled={saving}
              style={{ padding:'10px 22px', borderRadius:8, background:C.accent, color:'white', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Banner'}
            </button>
            <button type="button" onClick={resetForm}
              style={{ padding:'10px 18px', borderRadius:8, background:C.card2, border:`1px solid ${C.line}`, color:C.sub, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              {editingId ? 'Cancel Edit' : 'Reset'}
            </button>
          </div>
        </form>
      </div>

      <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.line}`, padding:22 }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:16, color:C.text, marginBottom:14 }}>
          All Banners ({banners.length})
        </div>
        {loading ? (
          <div style={{ padding:'30px', textAlign:'center', color:C.mute }}>Loading…</div>
        ) : banners.length === 0 ? (
          <div style={{ padding:'30px', textAlign:'center', color:C.mute, fontSize:13 }}>No banners yet — create your first one above.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {banners.map(b => (
              <div key={b._id} style={{ display:'grid', gridTemplateColumns:'200px 1fr auto', gap:14, padding:12, border:`1px solid ${C.line}`, borderRadius:10, background:C.bg, opacity: b.isActive ? 1 : 0.55 }}>
                <div style={{ width:200, height:80, borderRadius:6, overflow:'hidden', background:'#000', position:'relative' }}>
                  <img src={b.image} alt={b.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  {!b.isActive && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'white', textTransform:'uppercase', letterSpacing:'.1em' }}>Hidden</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{b.title}</div>
                  {b.subtitle && <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{b.subtitle}</div>}
                  <div style={{ display:'flex', gap:10, marginTop:6, fontSize:11, color:C.mute, flexWrap:'wrap' }}>
                    {b.overlayText && <span>🏷️ {b.overlayText}</span>}
                    {b.product?.title && <span>🔗 → {b.product.title}</span>}
                    {!b.product && b.link && <span>🔗 → {b.link}</span>}
                    <span>Order: {b.position ?? 0}</span>
                    {b.startDate && <span>From {new Date(b.startDate).toLocaleDateString()}</span>}
                    {b.endDate && <span>Until {new Date(b.endDate).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={() => startEdit(b)} style={{ padding:'6px 14px', borderRadius:6, background:'rgba(99,102,241,.12)', color:'#818cf8', border:'1px solid rgba(99,102,241,.3)', fontSize:12, fontWeight:600, cursor:'pointer' }}>Edit</button>
                  <button onClick={() => toggleActive(b)} style={{ padding:'6px 14px', borderRadius:6, background:C.card2, color:b.isActive ? C.yellow : C.green, border:`1px solid ${b.isActive ? C.yellow : C.green}40`, fontSize:12, fontWeight:600, cursor:'pointer' }}>{b.isActive ? 'Hide' : 'Show'}</button>
                  <button onClick={() => remove(b._id)} style={{ padding:'6px 14px', borderRadius:6, background:C.red+'18', color:C.red, border:`1px solid ${C.red}44`, fontSize:12, fontWeight:600, cursor:'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
