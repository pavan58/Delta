import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppProvider } from './state';

// Ask the browser not to evict our IndexedDB data under storage pressure (free, no prompt on most Android browsers).
if (navigator.storage?.persist) navigator.storage.persist().catch(() => undefined);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
