import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <button className="counter-button" onClick={() => setCount(c => c + 1)}>
        count is {count}
      </button>
      <p className="counter-hint">Click the button — then try asking specter to restyle it.</p>
    </div>
  );
}
