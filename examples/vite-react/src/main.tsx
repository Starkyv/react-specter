import React from 'react';
import { createRoot } from 'react-dom/client';
import { Specter } from 'react-specter';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {/* Render-nothing wrapper — mounts the overlay in dev only. The DEV guard
        is statically false in production builds, so the whole import
        tree-shakes away (zero specter bytes shipped). */}
    {import.meta.env.DEV && (
      <Specter
      // Customization points:
      // agentLabel="DevBot"
      // onSend={async payload => {
      //   await fetch('/api/devbot/edits', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(payload),
      //   });
      //   return 'Queued for DevBot ✓';
      // }}
      />
    )}
  </React.StrictMode>,
);
