import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import specter from 'react-specter/vite';

export default defineConfig({
  // specter() before the React plugin — annotation must see raw JSX.
  plugins: [specter(), react()],
  resolve: {
    // react-specter is symlinked from the repo root (link:../..), so its
    // built overlay would otherwise resolve the root repo's React copy.
    // Dedupe so the overlay and this app share one React.
    dedupe: ['react', 'react-dom'],
  },
});
