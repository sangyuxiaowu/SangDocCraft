import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {installExternalLinkInterceptor} from './utils/externalLink';

// Desktop builds must hand external links to the system browser instead of navigating the webview.
installExternalLinkInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
