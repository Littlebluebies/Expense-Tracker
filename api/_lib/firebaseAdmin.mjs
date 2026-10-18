import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "./config.mjs";

// admin SDK ข้าม Firestore Rules ได้ ใช้เฉพาะฝั่ง server
// สร้างครั้งเดียวต่อ instance (function ที่ยังอุ่นอยู่จะใช้ตัวเดิม)
const app = () => getApps()[0] ?? initializeApp({ credential: cert(config.serviceAccount()) });

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
