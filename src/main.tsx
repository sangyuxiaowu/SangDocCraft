import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {installExternalLinkInterceptor} from './utils/externalLink';
import {registerPwaUpdates} from './utils/pwaUpdates';

if (import.meta.env.PROD && import.meta.env.MODE !== 'tauri') {
  void registerPwaUpdates(import.meta.env.BASE_URL);
}

// Desktop builds must hand external links to the system browser instead of navigating the webview.
installExternalLinkInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
