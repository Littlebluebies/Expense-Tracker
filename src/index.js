import React from 'react';
import ReactDOM from 'react-dom/client';
import "bootstrap/dist/css/bootstrap.min.css";
// ฟอนต์อยู่ในเครื่อง (bundle ไปกับแอป) -> ออฟไลน์ก็ยังแสดงฟอนต์ถูก
import "@fontsource/anuphan/400.css";
import "@fontsource/anuphan/500.css";
import "@fontsource/anuphan/600.css";
import "@fontsource/anuphan/700.css";
import "@fontsource/trirong/500.css";
import "@fontsource/trirong/600.css";
import './index.css';
import App from './App';
import { applyTheme } from './utils/theme';

applyTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ลงทะเบียน service worker เฉพาะตอน build จริง (ตอน npm start จะไม่ใช้ กันแคชค้าง)
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL}/service-worker.js`)
      .catch((err) => console.error("Service worker registration failed:", err));
  });
}
