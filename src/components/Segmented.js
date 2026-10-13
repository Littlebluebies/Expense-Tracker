import { useId } from "react";

// กลุ่ม radio มาตรฐาน หน้าตาเป็นแถบเดียว
export default function Segmented({ label, value, onChange, options, block = false }) {
    const name = useId();
    return (
        <div className={`segmented ${block ? "is-block" : ""}`} role="radiogroup" aria-label={label}>
            {options.map((o) => (
                <span key={o.value} className="d-contents">
                    <input
                        type="radio"
                        id={`${name}-${o.value}`}
                        name={name}
                        value={o.value}
                        checked={value === o.value}
                        onChange={() => onChange(o.value)}
                    />
                    <label htmlFor={`${name}-${o.value}`} className={o.className}>
                        {o.label}
                    </label>
                </span>
            ))}
        </div>
    );
}
