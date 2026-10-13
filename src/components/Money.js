import { formatNumber } from "../utils/format";

const MINUS = "−";

// ตัวเลขเงิน: signed = แสดง +/− เสมอ, ไม่ signed = แสดง − เฉพาะค่าติดลบ
export default function Money({ value = 0, signed = false, size = "sm", className = "" }) {
    const negative = value < 0;
    const sign = negative ? MINUS : signed && value > 0 ? "+" : "";
    return (
        <span className={`money money-${size} ${className}`}>
            {sign}
            {formatNumber(Math.abs(value))}
            <span className="money-unit">฿</span>
        </span>
    );
}
