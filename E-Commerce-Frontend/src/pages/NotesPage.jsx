import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { notesApi } from '../api/notes';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await notesApi.list();
      setNotes(data.data?.notes || []);
    } catch {
      setError('Could not load notes. Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const saveNote = async (event) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) { setError('Add a title and note before saving.'); return; }
    setSaving(true); setError('');
    try {
      const { data } = await notesApi.create({ title, content });
      setNotes(current => [data.data.note, ...current]);
      setTitle(''); setContent('');
    } catch (err) { setError(err.response?.data?.message || 'Could not save note. Please try again.'); }
    finally { setSaving(false); }
  };

  const deleteNote = async (id) => {
    try {
      await notesApi.delete(id);
      setNotes(current => current.filter(note => note._id !== id));
    } catch (err) { setError(err.response?.data?.message || 'Could not delete note. Please try again.'); }
  };

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '32px 18px 64px', minHeight: '65vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <FileText color="#ff5a1f" size={30} />
        <div><h1 style={{ margin: 0, fontSize: 28, color: '#111827' }}>Shared Notes</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280' }}>Anyone can view, add, or delete notes on this page.</p></div>
      </div>
      <form onSubmit={saveNote} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, boxShadow: '0 4px 18px #1118270a' }}>
        <label style={{ display: 'block', fontWeight: 650, marginBottom: 7, color: '#374151' }} htmlFor="note-title">Title</label>
        <input id="note-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Give your note a title" style={inputStyle} />
        <label style={{ display: 'block', fontWeight: 650, margin: '16px 0 7px', color: '#374151' }} htmlFor="note-content">Note</label>
        <textarea id="note-content" value={content} onChange={e => setContent(e.target.value)} maxLength={10000} rows={5} placeholder="Write anything you want to remember…" style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }} />
        {error && <p role="alert" style={{ color: '#b91c1c', margin: '10px 0 0', fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={saving} style={{ marginTop: 14, border: 0, borderRadius: 7, background: '#ff5a1f', color: 'white', fontWeight: 700, padding: '11px 17px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}><Plus size={18} />{saving ? 'Saving…' : 'Save note'}</button>
      </form>
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 19, margin: '0 0 14px', color: '#111827' }}>Saved notes <span style={{ color: '#9ca3af', fontSize: 14, fontWeight: 500 }}>({notes.length})</span></h2>
        {loading ? <p style={{ color: '#6b7280' }}>Loading notes…</p> : notes.length === 0 ? <div style={{ padding: 28, border: '1px dashed #d1d5db', borderRadius: 10, color: '#6b7280', textAlign: 'center' }}>No notes yet. Add the first one above.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {notes.map(note => <article key={note._id} style={{ background: '#fffdf7', border: '1px solid #f1e7c9', borderRadius: 10, padding: 17, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><h3 style={{ margin: '0 0 10px', color: '#111827', fontSize: 17 }}>{note.title}</h3><button type="button" aria-label={`Delete ${note.title}`} title="Delete note" onClick={() => deleteNote(note._id)} style={{ border: 0, background: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: 3 }}><Trash2 size={17} /></button></div>
              <p style={{ margin: 0, color: '#374151', lineHeight: 1.6 }}>{note.content}</p>
              <time style={{ display: 'block', marginTop: 14, fontSize: 12, color: '#9ca3af' }}>{new Date(note.updatedAt).toLocaleString()}</time>
            </article>)}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 7, padding: '11px 12px', fontSize: 15, outlineColor: '#ff5a1f', color: '#111827' };
