import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useCompare } from '../../context/CompareContext';

export default function CompareBar() {
  const { items, remove, clear } = useCompare();
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line px-8 py-4 flex items-center gap-4 z-40 shadow-xl">
      <span className="font-bold text-sm shrink-0">Compare ({items.length}/4):</span>
      <div className="flex gap-3 flex-1">
        {items.map(p => {
          const pid = p._id || p.id;
          const image = p.images?.[0];
          return (
            <div key={pid} className="flex items-center gap-2.5 px-3 py-2 bg-surface rounded-[10px] text-[13px] font-semibold">
              {image ? <img src={image} alt={p.name} className="w-6 h-6 object-contain rounded" /> : <span>🛍️</span>}
              <span className="max-w-30 overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
              <button onClick={() => remove(pid)} className="bg-transparent border-0 cursor-pointer text-mute hover:text-ink ml-1" aria-label="Remove">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn btn-accent btn-sm shrink-0" onClick={() => navigate('/compare')}>Compare Now</button>
      <button className="btn btn-ghost btn-sm shrink-0" onClick={clear}>Clear</button>
    </div>
  );
}
