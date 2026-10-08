import { useApp } from '../../state/store';
import { Icon } from '../../ui/Icon';

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span>{t.text}</span>
          <button type="button" className="icon-btn" onClick={() => useApp.getState().dismissToast(t.id)} aria-label="Fermer">
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
