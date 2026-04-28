import { useEffect, useState } from 'react';
import { toast } from '../lib/toast.js';

export default function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => toast.subscribe(ev => {
    if (ev.type === 'add') setItems(s => [...s, ev.toast]);
    if (ev.type === 'remove') setItems(s => s.filter(t => t.id !== ev.id));
  }), []);
  if (!items.length) return null;
  return (
    <div className="toast-wrap">
      {items.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>
      ))}
    </div>
  );
}
