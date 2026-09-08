import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx'; // Imports your new orchestrated entry file
import './styles.css';       // Loads your global visual layouts
import './emoji.css';        // Ensures chat emoji use an emoji-capable font fallback

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
