import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initAnalytics } from '@/lib/analytics';
import './index.css';

// Analytics leggero e privacy-first (no-op se VITE_POSTHOG_KEY non è configurato).
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
