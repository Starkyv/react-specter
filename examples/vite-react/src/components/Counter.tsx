import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <div className="counter-controls">
        <button
          className="counter-btn counter-btn-minus"
          onClick={() => setCount(c => c - 1)}
          aria-label="Decrease"
        >
          −
        </button>
        <div className="counter-display">{count}</div>
        <button
          className="counter-btn counter-btn-plus"
          onClick={() => setCount(c => c + 1)}
          aria-label="Increase"
        >
          +
        </button>
      </div>
      <p className="counter-hint">Click + or − to adjust the counter.</p>
    </div>
  );
}
