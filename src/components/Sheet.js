import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

// dialog มาตรฐานของเบราว์เซอร์: Esc ปิดได้ โฟกัสอยู่ในกล่อง แตะพื้นหลังเพื่อปิด
// เนื้อหาไม่ถูก unmount ตอนปิด -> ฟอร์มจำค่าเดิมไว้ให้จดต่อ
export default function Sheet({ open, onClose, title, center = false, children }) {
    const ref = useRef(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            dialog.querySelector("[data-autofocus]")?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={ref}
            className={`sheet ${center ? "is-center" : ""}`}
            aria-labelledby={titleId}
            onClose={onClose}
            onClick={(e) => e.target === ref.current && onClose()}
        >
            <div className="sheet-body">
                {!center && <span className="sheet-grip" aria-hidden="true" />}
                <div className="sheet-head">
                    <h2 id={titleId}>{title}</h2>
                    <button
                        type="button"
                        className="btn btn-quiet icon-btn"
                        onClick={onClose}
                        aria-label="ปิด"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>
                {children}
            </div>
        </dialog>
    );
}
