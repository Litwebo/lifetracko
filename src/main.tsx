import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installDemoInterceptor } from './lib/demoStore.ts';

// Initialize the ephemeral Demo interceptor safely
try {
  installDemoInterceptor();
} catch (e) {
  console.warn('Demo interceptor initialization notice:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
