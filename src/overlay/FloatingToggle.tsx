/**
 * react-specter overlay — floating entry button (bottom-right).
 * Hotkey equivalent: Cmd/Ctrl+Shift+E.
 */
import cx from './cx';

export interface FloatingToggleProps {
  active: boolean;
  onToggle: () => void;
}

export default function FloatingToggle({ active, onToggle }: FloatingToggleProps) {
  return (
    <button
      type="button"
      className={cx('specter-toggle', active && 'is-active')}
      onClick={onToggle}
      title="Specter: select an element (⌘⇧E / Ctrl⇧E)">
      {active ? '✕' : '◎'}
    </button>
  );
}
