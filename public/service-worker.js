/* Service worker: ให้เปิดแอปได้แม้ออฟไลน์ + ติดตั้งเป็นแอปบนมือถือได้
   ข้อมูล (Firestore) ไม่ผ่านตรงนี้ — Firestore มี offline cache ของตัวเองอยู่แล้ว */

const CACHE = "expense-tracker-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/favicon.ico", "/logo192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const putInCache = (request, response) => {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // ไม่ยุ่งกับ request ข้ามโดเมน (Firebase, Google Fonts ฯลฯ)
  if (url.origin !== self.location.origin) return;
  // API (LINE Login callback ฯลฯ) ต้องไปถึง server เสมอ ห้ามตอบจากแคช
  if (url.pathname.startsWith("/api/")) return;

  // หน้าเว็บ: ลองเน็ตก่อน (จะได้เวอร์ชันใหม่เสมอ) ออฟไลน์ค่อยใช้ของในแคช
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache("/index.html", res))
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // ไฟล์ใน /static มีชื่อแบบ hash ไม่เปลี่ยนเนื้อหา -> ใช้แคชก่อน
  if (url.pathname.startsWith("/static/")) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => putInCache(request, res)))
    );
    return;
  }

  // ไฟล์อื่นๆ: ใช้แคชไปก่อน แล้วอัปเดตเบื้องหลัง
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => putInCache(request, res))
        .catch(() => hit);
      return hit || network;
    })
  );
});
