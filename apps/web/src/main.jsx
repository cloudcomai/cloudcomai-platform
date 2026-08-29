import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx'; // Imports your new orchestrated entry file
import './styles.css';       // Loads your global visual layouts

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
