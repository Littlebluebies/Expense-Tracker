import { CalendarDays, Repeat, WifiOff } from "lucide-react";
import Guilloche, { RosetteMark } from "./Guilloche";

const SAMPLE_NOTES = [1000, 500, 100, 50, 20];
const TILT = [-4, 2, -1.5, 3, -2.5];

// โครงหน้าเข้าสู่ระบบ/สมัคร: แถบสีหมึกแบงก์ + ฟอร์มบนกระดาษ
export default function AuthShell({ children }) {
    return (
        <div className="auth">
            <header className="band auth-band">
                <Guilloche variant="tall" />
                <span className="wordmark">
                    <RosetteMark />
                    รายจ่าย
                </span>
                <h1>
                    บันทึก<wbr />
                    <span>รายรับ-รายจ่าย</span>
                </h1>
                <p>จดเงินเข้าออกรายเดือน ตั้งงบ แล้วดูว่าเหลือใช้ได้วันละเท่าไหร่</p>
                <div className="notes auth-notes" aria-hidden="true">
                    {SAMPLE_NOTES.map((d, i) => (
                        <span
                            key={d}
                            className={`note note-${d} gap`}
                            style={{ "--i": i, "--r": `${TILT[i]}deg`, "--y": `${(i % 2) * 2}px` }}
                        >
                            {d}
                        </span>
                    ))}
                </div>
                <ul className="auth-facts">
                    <li>
                        <CalendarDays size={18} aria-hidden="true" />
                        ตั้งงบรายเดือนและงบรายหมวด
                    </li>
                    <li>
                        <Repeat size={18} aria-hidden="true" />
                        ลงค่าเช่า ค่าเน็ต เงินเดือน ให้อัตโนมัติทุกเดือน
                    </li>
                    <li>
                        <WifiOff size={18} aria-hidden="true" />
                        จดได้แม้ไม่มีอินเทอร์เน็ต แล้วซิงค์ให้เอง
                    </li>
                </ul>
            </header>
            <main className="auth-main">{children}</main>
        </div>
    );
}
