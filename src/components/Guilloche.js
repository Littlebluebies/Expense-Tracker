// ลายเส้นกิโยเช่แบบงานพิมพ์ธนบัตร (ลายเรขาคณิตล้วน ไม่มีภาพบุคคลหรือตราใดๆ)
// คำนวณเส้นครั้งเดียวตอนโหลดไฟล์ แล้วใช้ซ้ำ

const fmt = (n) => Math.round(n * 10) / 10;

// วงคลื่นซ้อนกัน: รัศมี r(θ) = R + A·sin(kθ + เฟส) ไขว้กันสองทิศเป็นลายถัก
function rosette({ cx, cy, r0, step, rings, amp, waves, phase, samples = 240 }) {
    const paths = [];
    [1, -1].forEach((dir) => {
        for (let i = 0; i < rings; i += 1) {
            const base = r0 + i * step;
            let d = "";
            for (let s = 0; s <= samples; s += 1) {
                const t = (s / samples) * Math.PI * 2;
                const r = base + amp * Math.sin(waves * t + dir * i * phase);
                d += `${s ? "L" : "M"}${fmt(cx + r * Math.cos(t))} ${fmt(cy + r * Math.sin(t))}`;
            }
            paths.push(`${d}Z`);
        }
    });
    return paths;
}

// แถบคลื่นแนวนอนซ้อนกัน
function waveBand({ y, width, lines, gap, amp, length, phase }) {
    const paths = [];
    for (let i = 0; i < lines; i += 1) {
        let d = "";
        for (let x = 0; x <= width; x += 4) {
            const yy = y + i * gap + amp * Math.sin((x / length) * Math.PI * 2 + i * phase);
            d += `${x ? "L" : "M"}${x} ${fmt(yy)}`;
        }
        paths.push(d);
    }
    return paths;
}

const VARIANTS = {
    band: {
        viewBox: "0 0 400 260",
        align: "xMaxYMid slice",
        paths: [
            ...rosette({ cx: 330, cy: 128, r0: 30, step: 6, rings: 9, amp: 5, waves: 18, phase: 0.42 }),
            ...waveBand({ y: 10, width: 400, lines: 6, gap: 3.2, amp: 5, length: 64, phase: 0.55 }),
            ...waveBand({ y: 226, width: 400, lines: 6, gap: 3.2, amp: 5, length: 64, phase: -0.55 }),
        ],
    },
    tall: {
        viewBox: "0 0 600 800",
        align: "xMidYMid slice",
        paths: [
            ...rosette({ cx: 440, cy: 215, r0: 44, step: 8.5, rings: 12, amp: 8, waves: 24, phase: 0.36 }),
            ...waveBand({ y: -6, width: 600, lines: 6, gap: 4, amp: 6, length: 90, phase: 0.5 }),
            ...waveBand({ y: 778, width: 600, lines: 6, gap: 4, amp: 6, length: 90, phase: -0.5 }),
        ],
    },
};

export default function Guilloche({ variant = "band" }) {
    const v = VARIANTS[variant];
    return (
        <svg
            className="guilloche"
            viewBox={v.viewBox}
            preserveAspectRatio={v.align}
            aria-hidden="true"
            focusable="false"
        >
            <g fill="none" stroke="currentColor" strokeWidth="0.7">
                {v.paths.map((d, i) => (
                    <path key={i} d={d} vectorEffect="non-scaling-stroke" />
                ))}
            </g>
        </svg>
    );
}

const MARK = rosette({ cx: 0, cy: 0, r0: 3.2, step: 2.3, rings: 3, amp: 1.1, waves: 9, phase: 0.6, samples: 120 });

// เครื่องหมายเล็กหน้าชื่อแอป
export function RosetteMark({ size = 22 }) {
    return (
        <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
            <g fill="none" stroke="currentColor" strokeWidth="1.1">
                {MARK.map((d, i) => (
                    <path key={i} d={d} />
                ))}
            </g>
        </svg>
    );
}
