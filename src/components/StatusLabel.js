import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";

const ICONS = { ok: CircleCheck, near: TriangleAlert, over: OctagonAlert };

// สถานะงบ: ไอคอน + ข้อความ + สี (ไม่พึ่งสีอย่างเดียว)
export default function StatusLabel({ status }) {
    const Icon = ICONS[status.tone];
    return (
        <span className={`status tone-${status.tone}`}>
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
            {status.text}
        </span>
    );
}
