import { useEffect } from 'react';
import { Icon } from './Shared.jsx';

// Notion-style image lightbox. Dim backdrop, large but not fullscreen image,
// click outside / X / ESC to close.
export default function Lightbox({ src, alt = '', caption, onClose }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', fn);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!src) return null;
  return (
    <div className="lightbox-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <Icon name="x" size={18}/>
      </button>
      <div className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="lightbox-img"/>
        {caption && <div className="lightbox-caption">{caption}</div>}
      </div>
    </div>
  );
}
