// "เงินต่อวัน" นับออกมาเป็นใบแบงก์: แตกยอดเป็นแบงก์พัน ห้าร้อย ร้อย ห้าสิบ ยี่สิบ
const DENOMS = [1000, 500, 100, 50, 20];
const NAMES = {
    1000: "แบงก์พัน",
    500: "แบงก์ห้าร้อย",
    100: "แบงก์ร้อย",
    50: "แบงก์ห้าสิบ",
    20: "แบงก์ยี่สิบ",
};
const TILT = [-3, 1.5, -1, 2.5, -2, 1, -1.5, 3, -0.5, 2];
const MAX_SHOWN = 9;

export function breakdown(amount) {
    let left = Math.max(0, Math.floor(amount));
    const notes = [];
    DENOMS.forEach((d) => {
        while (left >= d) {
            notes.push(d);
            left -= d;
        }
    });
    return notes;
}

const describe = (notes) =>
    DENOMS.map((d) => [d, notes.filter((n) => n === d).length])
        .filter(([, n]) => n > 0)
        .map(([d, n]) => `${NAMES[d]} ${n} ใบ`)
        .join(" ");

export default function NoteStack({ amount }) {
    const notes = breakdown(amount);

    if (notes.length === 0) return null;

    const shown = notes.slice(0, MAX_SHOWN);
    return (
        <div className="notes" role="img" aria-label={`ประมาณ ${describe(notes)}`}>
            {shown.map((d, i) => (
                <span
                    key={i}
                    className={`note note-${d} ${i > 0 && shown[i - 1] !== d ? "gap" : ""}`}
                    style={{ "--i": i, "--r": `${TILT[i % TILT.length]}deg`, "--y": `${(i % 3) - 1}px` }}
                    aria-hidden="true"
                >
                    {d}
                </span>
            ))}
            {notes.length > MAX_SHOWN && (
                <span className="note-more" aria-hidden="true">
                    +{notes.length - MAX_SHOWN} ใบ
                </span>
            )}
        </div>
    );
}
