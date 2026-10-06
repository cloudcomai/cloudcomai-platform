import React from 'react';
import { createRoot } from 'react-dom/client';
import { logger } from '@cloudcomai/api-client';
import App from './App.jsx';
import './styles.css';
import './global-theme.css';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);
logger.info('Web application started', { environment: import.meta.env.MODE });

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
