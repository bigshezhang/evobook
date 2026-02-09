
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import App from './App';

// 加载 Umami Analytics（如果配置了）
const umamiScriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
if (umamiScriptUrl && umamiWebsiteId) {
  const script = document.createElement('script');
  script.defer = true;
  script.src = umamiScriptUrl;
  script.setAttribute('data-website-id', umamiWebsiteId);
  document.head.appendChild(script);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
