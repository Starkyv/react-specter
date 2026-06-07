/**
 * react-specter overlay — outline box over the current hover/selection anchor.
 *
 * Positioned via CSS custom properties set imperatively (never mutates the
 * target element). Repositions on scroll/resize.
 */
import { useLayoutEffect, useRef } from 'react';

import cx from './cx';
import { componentOf } from './payload';

export interface HoverOutlineProps {
  target: HTMLElement | null;
  captured?: boolean;
}

export default function HoverOutline({ target, captured = false }: HoverOutlineProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!target || !box) return;

    let raf = 0;
    const update = () => {
      const rect = target.getBoundingClientRect();
      box.style.setProperty('--specter-top', `${rect.top}px`);
      box.style.setProperty('--specter-left', `${rect.left}px`);
      box.style.setProperty('--specter-width', `${rect.width}px`);
      box.style.setProperty('--specter-height', `${rect.height}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [target]);

  if (!target) return null;

  return (
    <div ref={boxRef} className={cx('specter-outline', captured && 'is-captured')}>
      <span className="specter-outline-label">
        {componentOf(target)} · {target.tagName.toLowerCase()}
      </span>
    </div>
  );
}
