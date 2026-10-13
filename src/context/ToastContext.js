import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";

const ToastContext = createContext(() => {});

const ICONS = { success: CircleCheck, danger: OctagonAlert, warning: TriangleAlert };

// notify(ข้อความ, "success" | "danger" | "warning", { label, onClick }?)
// ถ้ามี action (เช่น "เลิกทำ") จะค้างไว้นานขึ้นให้กดทัน
export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const timer = useRef();

    const notify = useCallback((text, variant = "success", action = null) => {
        clearTimeout(timer.current);
        setToast({ text, variant, action, id: Date.now() });
        timer.current = setTimeout(() => setToast(null), action ? 5000 : 2500);
    }, []);

    const runAction = () => {
        const { action } = toast;
        clearTimeout(timer.current);
        setToast(null);
        action.onClick();
    };

    const Icon = toast && (ICONS[toast.variant] || CircleCheck);

    return (
        <ToastContext.Provider value={notify}>
            {children}
            <div role="status" aria-live="polite">
                {toast && (
                    <div key={toast.id} className={`app-toast is-${toast.variant}`}>
                        <Icon size={18} aria-hidden="true" />
                        <span>{toast.text}</span>
                        {toast.action && (
                            <button type="button" className="toast-action" onClick={runAction}>
                                {toast.action.label}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
