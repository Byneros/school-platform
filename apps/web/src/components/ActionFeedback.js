import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
const toneStyles = {
    success: {
        color: "#15803d",
        background: "#f0fdf4",
        border: "#86efac",
        defaultTitle: "Operacion completada"
    },
    error: {
        color: "#b91c1c",
        background: "#fef2f2",
        border: "#fecaca",
        defaultTitle: "Ocurrio un error"
    },
    info: {
        color: "#1d4ed8",
        background: "#eff6ff",
        border: "#93c5fd",
        defaultTitle: "Informacion"
    },
    warning: {
        color: "#b45309",
        background: "#fffbeb",
        border: "#fcd34d",
        defaultTitle: "Atencion"
    }
};
export default function ActionFeedback({ message, title, tone = "info", onDismiss, autoHideMs = 5000, highlightMs = 2200, style }) {
    const ref = useRef(null);
    const onDismissRef = useRef(onDismiss);
    const [highlight, setHighlight] = useState(false);
    const palette = toneStyles[tone];
    const liveMode = tone === "error" ? "assertive" : "polite";
    const role = tone === "error" ? "alert" : "status";
    useEffect(() => {
        onDismissRef.current = onDismiss;
    }, [onDismiss]);
    useEffect(() => {
        if (!message)
            return;
        setHighlight(true);
        requestAnimationFrame(() => {
            ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        const highlightTimer = window.setTimeout(() => setHighlight(false), highlightMs);
        const clearTimer = onDismissRef.current
            ? window.setTimeout(() => {
                onDismissRef.current?.();
                setHighlight(false);
            }, autoHideMs)
            : null;
        return () => {
            window.clearTimeout(highlightTimer);
            if (clearTimer)
                window.clearTimeout(clearTimer);
        };
    }, [message, autoHideMs, highlightMs]);
    if (!message)
        return null;
    return (_jsxs("div", { ref: ref, role: role, "aria-live": liveMode, "aria-atomic": "true", tabIndex: -1, className: "card", style: {
            marginBottom: 12,
            color: palette.color,
            background: palette.background,
            border: `1px solid ${palette.border}`,
            boxShadow: highlight
                ? `0 0 0 4px ${palette.border}55, 0 18px 40px -24px ${palette.border}`
                : "none",
            transform: highlight ? "translateY(-2px)" : "translateY(0)",
            transition: "box-shadow 220ms ease, transform 220ms ease",
            ...style
        }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 4 }, children: title || palette.defaultTitle }), _jsx("div", { children: message })] }));
}
