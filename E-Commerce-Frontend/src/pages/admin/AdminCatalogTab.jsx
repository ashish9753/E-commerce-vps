import { useState, useEffect, Fragment } from 'react';
import { brandsApi, categoriesApi, attributesApi, eventsApi } from '../../api/catalog';
import { useCatalog } from '../../context/CatalogContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { C } from '../../theme/dashboardTheme';

const SECTIONS = [
  { id: 'brands',     label: 'Brands',            icon: '🏷️' },
  { id: 'categories', label: 'Categories',         icon: '📂' },
  { id: 'subcats',    label: 'Sub-categories',     icon: '📁' },
  { id: 'attributes', label: 'Attributes',         icon: '⚙️' },
  { id: 'events',     label: 'Events / Schemes',   icon: '🎉' },
];

/* ── shared helpers ── */
function Card({ children }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '22px', marginBottom: 16 }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 16 }}>{children}</div>;
}

function Input({ label, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>{label}</label>}
      <input style={{ height: 38, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 6,
        fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', background: C.bg, color: C.text }} {...props} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>{label}</label>}
      <select style={{ height: 38, padding: '0 10px', border: `1px solid ${C.border}`, borderRadius: 6,
        fontSize: 13, outline: 'none', background: C.bg, color: C.text, width: '100%' }} {...props}>
        {children}
      </select>
    </div>
  );
}

function Btn({ children, variant = 'primary', ...props }) {
  const styles = {
    primary: { background: C.accent,    color: 'white',  border: 'none' },
    danger:  { background: C.red,       color: 'white',  border: 'none' },
    ghost:   { background: C.card2,     color: C.sub,    border: `1px solid ${C.border}` },
    edit:    { background: 'rgba(99,102,241,.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,.3)' },
  };
  return (
    <button style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif",
      ...styles[variant] }} {...props}>
      {children}
    </button>
  );
}

function Tag({ label, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(249,115,22,.12)',
      border: '1px solid rgba(249,115,22,.3)', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: C.accent }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer',
        color: C.accent, fontWeight: 800, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
    </span>
  );
}

function EmptyRow({ cols, text }) {
  return (
    <tr><td colSpan={cols} style={{ textAlign: 'center', padding: '32px', color: C.mute, fontSize: 13 }}>{text}</td></tr>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr style={{ background: C.surface }}>
        {cols.map(c => (
          <th key={c} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11,
            fontWeight: 700, color: C.mute, textTransform: 'uppercase', letterSpacing: '.06em',
            borderBottom: `1px solid ${C.border}` }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function ErrorBar({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6,
      padding: '10px 12px', marginBottom: 12, fontSize: 13, color: C.red, fontWeight: 500 }}>
      ⚠️ {msg}
    </div>
  );
}

/* ════════════════════ BRANDS ════════════════════ */
function BrandsSection({ onMutate }) {
  const [brands, setBrands] = useState([]);
  const [draft, setDraft, clearDraft] = useFormDraft('catalog-brand', { name: '', logo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', logo: '' });
  const [editSaving, setEditSaving] = useState(false);

  const load = () => brandsApi.getAllAdmin()
    .then(r => setBrands(r.data?.data?.brands || []))
    .catch(() => setError('Failed to load brands'));
  useEffect(() => { load(); }, []);

  const restore = async (id) => {
    setError('');
    try { await brandsApi.restore(id); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to restore brand'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true); setError('');
    try {
      await brandsApi.create({ name: draft.name.trim(), logo: draft.logo.trim() || undefined });
      clearDraft(); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Failed to create brand'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setError('');
    try { await brandsApi.remove(id); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to delete brand'); }
  };

  const startEdit = (b) => { setEditingId(b._id); setEditDraft({ name: b.name, logo: b.logo || '' }); };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    if (!editDraft.name.trim()) return;
    setEditSaving(true); setError('');
    try {
      await brandsApi.update(id, { name: editDraft.name.trim(), logo: editDraft.logo.trim() || undefined });
      setEditingId(null); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || 'Failed to update brand'); }
    finally { setEditSaving(false); }
  };

  return (
    <>
      <Card>
        <SectionTitle>Add Brand</SectionTitle>
        <ErrorBar msg={error} />
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Input label="Brand Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Samsung" required /></div>
            <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : '+ Add Brand'}</Btn>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Input label="Logo URL (optional)" value={draft.logo} onChange={e => setDraft(d => ({ ...d, logo: e.target.value }))} placeholder="https://example.com/logo.png" />
            </div>
            {draft.logo.trim() && (
              <div style={{ width: 44, height: 44, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, marginTop: 18 }}>
                <img src={draft.logo.trim()} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              </div>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle>All Brands</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <TableHead cols={['Logo', 'Brand Name', 'Slug / Logo URL', 'Action']} />
          <tbody>
            {brands.length === 0 ? <EmptyRow cols={4} text="No brands yet" /> :
              brands.map(b => editingId === b._id ? (
                <tr key={b._id} style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(30,37,53,.85)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {editDraft.logo
                        ? <img src={editDraft.logo} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                        : <span style={{ fontWeight: 800, fontSize: 15, color: C.accent }}>{(editDraft.name || '?').charAt(0).toUpperCase()}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} placeholder="Brand name" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Input value={editDraft.logo} onChange={e => setEditDraft(d => ({ ...d, logo: e.target.value }))} placeholder="Logo URL (optional)" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn onClick={() => saveEdit(b._id)} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</Btn>
                      <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={b._id} style={{ borderBottom: `1px solid ${C.border}`, opacity: b.isActive === false ? 0.6 : 1 }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {b.logo
                        ? <img src={b.logo} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                        : null}
                      <span style={{ display: b.logo ? 'none' : 'flex', width: '100%', height: '100%',
                        alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: C.accent }}>
                        {b.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: C.text }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {b.name}
                      {b.isActive === false && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(234,179,8,.15)', color: '#eab308', border: '1px solid rgba(234,179,8,.35)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                          Hidden
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute, fontFamily: 'monospace' }}>{b.slug}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="edit" onClick={() => startEdit(b)}>Edit</Btn>
                      {b.isActive === false
                        ? <Btn variant="primary" onClick={() => restore(b._id)}>Restore</Btn>
                        : <Btn variant="danger" onClick={() => remove(b._id)}>Delete</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

/* ════════════════════ CATEGORIES ════════════════════ */
function CategoriesSection({ onMutate }) {
  const [cats, setCats] = useState([]);
  const [draft, setDraft, clearDraft] = useFormDraft('catalog-category', { name: '', desc: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', desc: '', imageUrl: '' });
  const [editSaving, setEditSaving] = useState(false);

  const topLevel = cats.filter(c => !c.parent);
  const load = () => categoriesApi.getAll()
    .then(r => setCats(r.data?.data?.categories || []))
    .catch(() => setError('Failed to load categories'));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true); setError('');
    try {
      await categoriesApi.create({ name: draft.name.trim(), description: draft.desc, imageUrl: draft.imageUrl.trim() || undefined });
      clearDraft(); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Failed to create category'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setError('');
    try { await categoriesApi.remove(id); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to delete category'); }
  };

  const startEdit = (c) => { setEditingId(c._id); setEditDraft({ name: c.name, desc: c.description || '', imageUrl: c.image || '' }); };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    if (!editDraft.name.trim()) return;
    setEditSaving(true); setError('');
    try {
      await categoriesApi.update(id, { name: editDraft.name.trim(), description: editDraft.desc, imageUrl: editDraft.imageUrl.trim() || undefined });
      setEditingId(null); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || 'Failed to update category'); }
    finally { setEditSaving(false); }
  };

  return (
    <>
      <Card>
        <SectionTitle>Add Category</SectionTitle>
        <ErrorBar msg={error} />
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
            <Input label="Category Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Washing Machines" required />
            <Input label="Description (optional)" value={draft.desc} onChange={e => setDraft(d => ({ ...d, desc: e.target.value }))} placeholder="Short description" />
            <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : '+ Add'}</Btn>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Input label="Image URL (optional)" value={draft.imageUrl} onChange={e => setDraft(d => ({ ...d, imageUrl: e.target.value }))} placeholder="https://example.com/category.png" />
            </div>
            {draft.imageUrl.trim() && (
              <div style={{ width: 44, height: 44, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, marginTop: 18 }}>
                <img src={draft.imageUrl.trim()} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
              </div>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle>Top-level Categories</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <TableHead cols={['Image', 'Name', 'Slug', 'Description', 'Action']} />
          <tbody>
            {topLevel.length === 0 ? <EmptyRow cols={5} text="No categories yet" /> :
              topLevel.map(c => editingId === c._id ? (
                <tr key={c._id} style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(30,37,53,.85)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {editDraft.imageUrl
                        ? <img src={editDraft.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                        : <span style={{ fontWeight: 800, fontSize: 15, color: C.accent }}>{(editDraft.name || '?').charAt(0).toUpperCase()}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} placeholder="Category name" />
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute, fontFamily: 'monospace' }}>{c.slug}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <Input value={editDraft.desc} onChange={e => setEditDraft(d => ({ ...d, desc: e.target.value }))} placeholder="Description" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Input value={editDraft.imageUrl} onChange={e => setEditDraft(d => ({ ...d, imageUrl: e.target.value }))} placeholder="Image URL (optional)" />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn onClick={() => saveEdit(c._id)} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</Btn>
                        <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c._id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {c.image
                        ? <img src={c.image} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontWeight: 800, fontSize: 15, color: C.accent }}>{c.name.charAt(0).toUpperCase()}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: C.text }}>{c.name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute, fontFamily: 'monospace' }}>{c.slug}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute }}>{c.description || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="edit" onClick={() => startEdit(c)}>Edit</Btn>
                      <Btn variant="danger" onClick={() => remove(c._id)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

/* ════════════════════ SUB-CATEGORIES ════════════════════ */
function SubCategoriesSection({ onMutate }) {
  const [cats, setCats] = useState([]);
  const [draft, setDraft, clearDraft] = useFormDraft('catalog-subcat', { name: '', parent: '', desc: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', parent: '', desc: '' });
  const [editSaving, setEditSaving] = useState(false);

  const topLevel = cats.filter(c => !c.parent);
  const subCats  = cats.filter(c => c.parent);
  const load = () => categoriesApi.getAll()
    .then(r => setCats(r.data?.data?.categories || []))
    .catch(() => setError('Failed to load categories'));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.parent) return;
    setSaving(true); setError('');
    try {
      await categoriesApi.create({ name: draft.name.trim(), description: draft.desc, parent: draft.parent });
      clearDraft(); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Failed to create sub-category'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setError('');
    try { await categoriesApi.remove(id); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to delete sub-category'); }
  };

  const startEdit = (c) => { setEditingId(c._id); setEditDraft({ name: c.name, parent: c.parent?._id || c.parent || '', desc: c.description || '' }); };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    if (!editDraft.name.trim() || !editDraft.parent) return;
    setEditSaving(true); setError('');
    try {
      await categoriesApi.update(id, { name: editDraft.name.trim(), description: editDraft.desc, parent: editDraft.parent });
      setEditingId(null); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || 'Failed to update sub-category'); }
    finally { setEditSaving(false); }
  };

  return (
    <>
      <Card>
        <SectionTitle>Add Sub-category</SectionTitle>
        <ErrorBar msg={error} />
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <Select label="Parent Category" value={draft.parent} onChange={e => setDraft(d => ({ ...d, parent: e.target.value }))} required>
            <option value="">Select parent…</option>
            {topLevel.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
          <Input label="Sub-category Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Front Load" required />
          <Input label="Description (optional)" value={draft.desc} onChange={e => setDraft(d => ({ ...d, desc: e.target.value }))} placeholder="Short description" />
          <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : '+ Add'}</Btn>
        </form>
      </Card>

      <Card>
        <SectionTitle>All Sub-categories</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <TableHead cols={['Sub-category', 'Parent', 'Description', 'Action']} />
          <tbody>
            {subCats.length === 0 ? <EmptyRow cols={4} text="No sub-categories yet" /> :
              subCats.map(c => editingId === c._id ? (
                <tr key={c._id} style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(30,37,53,.85)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <Input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} placeholder="Sub-category name" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <select value={editDraft.parent} onChange={e => setEditDraft(d => ({ ...d, parent: e.target.value }))}
                      style={{ height: 38, padding: '0 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', background: C.bg, color: C.text, width: '100%' }}>
                      <option value="">Select parent…</option>
                      {topLevel.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Input value={editDraft.desc} onChange={e => setEditDraft(d => ({ ...d, desc: e.target.value }))} placeholder="Description (optional)" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn onClick={() => saveEdit(c._id)} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</Btn>
                      <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c._id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: C.text }}>{c.name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute }}>{c.parent?.name || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute }}>{c.description || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="edit" onClick={() => startEdit(c)}>Edit</Btn>
                      <Btn variant="danger" onClick={() => remove(c._id)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

/* ════════════════════ ATTRIBUTES ════════════════════ */
function AttributesSection({ onMutate }) {
  const [attrs, setAttrs] = useState([]);
  const [cats, setCats]   = useState([]);
  const [draft, setDraft, clearDraft] = useFormDraft('catalog-attr', { name: '', unit: '', subcat: '', options: [] });
  const [optInput, setOptInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', unit: '', subcat: '', options: [] });
  const [editOptInput, setEditOptInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const subCats = cats.filter(c => c.parent);

  const load = () => {
    attributesApi.getAll().then(r => setAttrs(r.data?.data?.attributes || [])).catch(() => setError('Failed to load attributes'));
    categoriesApi.getAll().then(r => setCats(r.data?.data?.categories || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const addOption = () => {
    const val = optInput.trim();
    if (val && !draft.options.includes(val)) setDraft(d => ({ ...d, options: [...d.options, val] }));
    setOptInput('');
  };

  const addEditOption = () => {
    const val = editOptInput.trim();
    if (val && !editDraft.options.includes(val)) setEditDraft(d => ({ ...d, options: [...d.options, val] }));
    setEditOptInput('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.subcat) return;
    setSaving(true); setError('');
    try {
      await attributesApi.create({ name: draft.name.trim(), unit: draft.unit.trim(), subcategory: draft.subcat, options: draft.options });
      clearDraft(); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || err.message || 'Failed to create attribute'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setError('');
    try { await attributesApi.remove(id); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to delete attribute'); }
  };

  const startEdit = (a) => {
    setEditingId(a._id);
    setEditDraft({ name: a.name, unit: a.unit || '', subcat: a.subcategory?._id || a.subcategory || '', options: [...(a.options || [])] });
    setEditOptInput('');
  };
  const cancelEdit = () => { setEditingId(null); setEditOptInput(''); };
  const saveEdit = async (id) => {
    if (!editDraft.name.trim() || !editDraft.subcat) return;
    setEditSaving(true); setError('');
    try {
      await attributesApi.update(id, { name: editDraft.name.trim(), unit: editDraft.unit.trim(), subcategory: editDraft.subcat, options: editDraft.options });
      setEditingId(null); load(); onMutate?.();
    } catch (err) { setError(err.response?.data?.message || 'Failed to update attribute'); }
    finally { setEditSaving(false); }
  };

  return (
    <>
      <Card>
        <SectionTitle>Add Attribute</SectionTitle>
        <ErrorBar msg={error} />
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <Select label="Sub-category" value={draft.subcat} onChange={e => setDraft(d => ({ ...d, subcat: e.target.value }))} required>
              <option value="">Select sub-category…</option>
              {subCats.map(c => <option key={c._id} value={c._id}>{c.name} ({c.parent?.name})</option>)}
            </Select>
            <Input label="Attribute Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Capacity" required />
            <Input label="Unit (optional)" value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} placeholder="e.g. kg, ton, L" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.mute, display: 'block', marginBottom: 6 }}>Options</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={optInput} onChange={e => setOptInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                placeholder="Type option and press Enter or Add…"
                className="inp-dark"
                style={{ flex: 1, height: 36, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', background: C.bg, color: C.text }} />
              <Btn type="button" variant="ghost" onClick={addOption}>Add</Btn>
            </div>
            {draft.options.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {draft.options.map(o => <Tag key={o} label={o} onRemove={() => setDraft(d => ({ ...d, options: d.options.filter(x => x !== o) }))} />)}
              </div>
            )}
          </div>

          <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : '+ Add Attribute'}</Btn>
        </form>
      </Card>

      <Card>
        <SectionTitle>All Attributes</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <TableHead cols={['Attribute', 'Unit', 'Sub-category', 'Options', 'Action']} />
          <tbody>
            {attrs.length === 0 ? <EmptyRow cols={5} text="No attributes yet" /> :
              attrs.map(a => (
                <Fragment key={a._id}>
                  <tr style={{ borderBottom: editingId === a._id ? 'none' : `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: C.text }}>{a.name}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute }}>{a.unit || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute }}>{a.subcategory?.name || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(a.options || []).map(o => (
                          <span key={o} style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 99,
                            padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#3730a3' }}>{o}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant="edit" onClick={() => editingId === a._id ? cancelEdit() : startEdit(a)}>
                          {editingId === a._id ? 'Close' : 'Edit'}
                        </Btn>
                        <Btn variant="danger" onClick={() => remove(a._id)}>Delete</Btn>
                      </div>
                    </td>
                  </tr>
                  {editingId === a._id && (
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(30,37,53,.85)' }}>
                      <td colSpan={5} style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                          <select value={editDraft.subcat} onChange={e => setEditDraft(d => ({ ...d, subcat: e.target.value }))}
                            style={{ height: 38, padding: '0 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', background: C.bg, color: C.text }}>
                            <option value="">Select sub-category…</option>
                            {subCats.map(c => <option key={c._id} value={c._id}>{c.name} ({c.parent?.name})</option>)}
                          </select>
                          <Input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} placeholder="Attribute name" />
                          <Input value={editDraft.unit} onChange={e => setEditDraft(d => ({ ...d, unit: e.target.value }))} placeholder="Unit (optional)" />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.mute, marginBottom: 6 }}>Options</div>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <input value={editOptInput} onChange={e => setEditOptInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEditOption(); } }}
                              placeholder="Add option…"
                              style={{ flex: 1, height: 34, padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', background: C.bg, color: C.text }} />
                            <Btn type="button" variant="ghost" onClick={addEditOption}>Add</Btn>
                          </div>
                          {editDraft.options.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {editDraft.options.map(o => <Tag key={o} label={o} onRemove={() => setEditDraft(d => ({ ...d, options: d.options.filter(x => x !== o) }))} />)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Btn onClick={() => saveEdit(a._id)} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</Btn>
                          <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

/* ════════════════════ EVENTS ════════════════════ */
function EventsSection({ onMutate }) {
  const [events, setEvents] = useState([]);
  const [draft, setDraft, clearDraft] = useFormDraft('catalog-event', { name: '', badge: '', desc: '', discount: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', badge: '', desc: '', discount: '', startDate: '', endDate: '' });
  const [editSaving, setEditSaving] = useState(false);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const setE = (k, v) => setEditDraft(d => ({ ...d, [k]: v }));

  const toDateInput = (d) => d ? new Date(d).toISOString().slice(0, 10) : '';

  const load = () => eventsApi.getAll()
    .then(r => setEvents(r.data?.data?.events || []))
    .catch(() => setError('Failed to load events'));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.startDate || !draft.endDate) return;
    setSaving(true); setError('');
    const fd = new FormData();
    fd.append('name', draft.name.trim());
    fd.append('badge', draft.badge.trim());
    fd.append('description', draft.desc);
    fd.append('discountPercent', draft.discount || 0);
    fd.append('startDate', draft.startDate);
    fd.append('endDate', draft.endDate);
    try { await eventsApi.create(fd); clearDraft(); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || err.message || 'Failed to create event'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    setError('');
    try { await eventsApi.remove(id); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to delete event'); }
  };

  const toggleActive = async (ev) => {
    setError('');
    const fd = new FormData();
    fd.append('isActive', !ev.isActive);
    try { await eventsApi.update(ev._id, fd); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to toggle event'); }
  };

  const startEdit = (ev) => {
    setEditingId(ev._id);
    setEditDraft({ name: ev.name, badge: ev.badge || '', desc: ev.description || '',
      discount: ev.discountPercent?.toString() || '', startDate: toDateInput(ev.startDate), endDate: toDateInput(ev.endDate) });
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id) => {
    if (!editDraft.name.trim() || !editDraft.startDate || !editDraft.endDate) return;
    setEditSaving(true); setError('');
    const fd = new FormData();
    fd.append('name', editDraft.name.trim());
    fd.append('badge', editDraft.badge.trim());
    fd.append('description', editDraft.desc);
    fd.append('discountPercent', editDraft.discount || 0);
    fd.append('startDate', editDraft.startDate);
    fd.append('endDate', editDraft.endDate);
    try { await eventsApi.update(id, fd); setEditingId(null); load(); onMutate?.(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to update event'); }
    finally { setEditSaving(false); }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const isLive = (ev) => {
    const now = Date.now();
    return ev.isActive && new Date(ev.startDate) <= now && new Date(ev.endDate) >= now;
  };

  return (
    <>
      <Card>
        <SectionTitle>Create Event / Scheme</SectionTitle>
        <ErrorBar msg={error} />
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Input label="Event Name *" value={draft.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Dashain Mega Sale" required />
            <Input label="Badge / Code" value={draft.badge} onChange={e => set('badge', e.target.value.toUpperCase())} placeholder="e.g. DASHAIN50" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Input label="Discount %" type="number" min="0" max="100" value={draft.discount} onChange={e => set('discount', e.target.value)} placeholder="e.g. 50" />
            <Input label="Start Date *" type="date" value={draft.startDate} onChange={e => set('startDate', e.target.value)} required />
            <Input label="End Date *" type="date" value={draft.endDate} onChange={e => set('endDate', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.mute, display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={draft.desc} onChange={e => set('desc', e.target.value)} rows={2}
              placeholder="Short description of the event…"
              className="inp-dark"
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6,
                fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: C.bg, color: C.text }} />
          </div>
          <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : '🎉 Create Event'}</Btn>
        </form>
      </Card>

      <Card>
        <SectionTitle>All Events / Schemes</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <TableHead cols={['Event', 'Badge', 'Discount', 'Dates', 'Status', 'Actions']} />
          <tbody>
            {events.length === 0 ? <EmptyRow cols={6} text="No events yet" /> :
              events.map(ev => (
                <Fragment key={ev._id}>
                  <tr style={{ borderBottom: editingId === ev._id ? 'none' : `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{ev.name}</div>
                      {ev.description && <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>{ev.description}</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {ev.badge ? (
                        <span style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 4,
                          padding: '2px 8px', fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>
                          {ev.badge}
                        </span>
                      ) : <span style={{ color: C.mute }}>—</span>}
                      {ev.coupon?.code && ev.coupon.code !== ev.badge && (
                        <div style={{ fontSize: 10, color: C.green, marginTop: 4, fontFamily: 'monospace' }}>
                          → coupon: {ev.coupon.code}
                        </div>
                      )}
                      {ev.coupon?.code && (
                        <div style={{ fontSize: 10, color: C.mute, marginTop: 2 }}>
                          {ev.coupon.isActive ? '🟢 active in coupons' : '⚪ inactive'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.accent }}>
                      {ev.discountPercent > 0 ? `${ev.discountPercent}%` : <span style={{ color: C.mute }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.mute }}>
                      {fmt(ev.startDate)} → {fmt(ev.endDate)}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isLive(ev) ? (
                        <span style={{ background: 'rgba(34,197,94,.15)', color: C.green, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Live</span>
                      ) : ev.isActive ? (
                        <span style={{ background: 'rgba(234,179,8,.15)', color: '#eab308', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Scheduled</span>
                      ) : (
                        <span style={{ background: 'rgba(107,114,128,.15)', color: C.mute, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Inactive</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant="edit" onClick={() => editingId === ev._id ? cancelEdit() : startEdit(ev)}>
                          {editingId === ev._id ? 'Close' : 'Edit'}
                        </Btn>
                        <Btn variant="ghost" onClick={() => toggleActive(ev)}>{ev.isActive ? 'Deactivate' : 'Activate'}</Btn>
                        <Btn variant="danger" onClick={() => remove(ev._id)}>Delete</Btn>
                      </div>
                    </td>
                  </tr>
                  {editingId === ev._id && (
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: 'rgba(30,37,53,.85)' }}>
                      <td colSpan={6} style={{ padding: '16px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                          <Input value={editDraft.name} onChange={e => setE('name', e.target.value)} placeholder="Event name *" />
                          <Input value={editDraft.badge} onChange={e => setE('badge', e.target.value.toUpperCase())} placeholder="Badge / Code" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                          <Input type="number" min="0" max="100" value={editDraft.discount} onChange={e => setE('discount', e.target.value)} placeholder="Discount %" />
                          <Input type="date" value={editDraft.startDate} onChange={e => setE('startDate', e.target.value)} />
                          <Input type="date" value={editDraft.endDate} onChange={e => setE('endDate', e.target.value)} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <textarea value={editDraft.desc} onChange={e => setE('desc', e.target.value)} rows={2}
                            placeholder="Description…"
                            style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6,
                              fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', background: C.bg, color: C.text }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Btn onClick={() => saveEdit(ev._id)} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</Btn>
                          <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

/* ════════════════════ MAIN EXPORT ════════════════════ */
export default function AdminCatalogTab() {
  const [section, setSection] = useState('brands');
  const { refresh } = useCatalog();

  const renderSection = () => {
    if (section === 'brands')     return <BrandsSection onMutate={refresh} />;
    if (section === 'categories') return <CategoriesSection onMutate={refresh} />;
    if (section === 'subcats')    return <SubCategoriesSection onMutate={refresh} />;
    if (section === 'attributes') return <AttributesSection onMutate={refresh} />;
    if (section === 'events')     return <EventsSection onMutate={refresh} />;
  };

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {/* Left mini-nav */}
      <div style={{ width: 190, flexShrink: 0 }}>
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '8px 8px' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
                background: section === s.id ? C.active : 'transparent',
                border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                fontSize: 13.5, fontWeight: section === s.id ? 600 : 400,
                color: section === s.id ? C.text : C.sub, textAlign: 'left',
                fontFamily: "'DM Sans', sans-serif",
              }}>
              <span style={{ fontSize: 15, opacity: section === s.id ? 1 : 0.7 }}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renderSection()}
      </div>
    </div>
  );
}
