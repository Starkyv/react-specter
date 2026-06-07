/**
 * react-specter overlay — floating launcher button (bottom-right). Opens the
 * prompt box; hidden while the box is open (the box's ✕ brings this back).
 * Hotkey equivalent: Cmd/Ctrl+Shift+E.
 */
import { SparkleIcon } from './icons';

export interface FloatingToggleProps {
  onOpen: () => void;
}

export default function FloatingToggle({ onOpen }: FloatingToggleProps) {
  return (
    <button
      type="button"
      className="specter-toggle"
      onClick={onOpen}
      title="Specter: open the prompt box (⌘⇧E / Ctrl⇧E)">
      <SparkleIcon size={18} />
    </button>
  );
}
