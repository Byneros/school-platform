import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export default function Autocomplete({ value, options, placeholder, className, onChange, onSelectOption }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const filtered = useMemo(() => {
        const q = value.toLowerCase();
        if (!q)
            return options.slice(0, 8);
        return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8);
    }, [value, options]);
    return (_jsxs("div", { style: { position: "relative" }, children: [_jsx("input", { className: className || "input", value: value, placeholder: placeholder, onChange: (e) => {
                    onChange(e.target.value);
                    setOpen(true);
                    setActive(0);
                }, onFocus: () => setOpen(true), onBlur: () => setTimeout(() => setOpen(false), 150), onKeyDown: (e) => {
                    if (!open)
                        return;
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActive((a) => Math.min(a + 1, filtered.length - 1));
                    }
                    if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActive((a) => Math.max(a - 1, 0));
                    }
                    if (e.key === "Enter") {
                        e.preventDefault();
                        const item = filtered[active];
                        if (item) {
                            onChange(item.value);
                            onSelectOption?.(item);
                            setOpen(false);
                        }
                    }
                } }), open && filtered.length > 0 && (_jsx("div", { style: {
                    position: "absolute",
                    zIndex: 20,
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    width: "100%",
                    boxShadow: "var(--shadow)",
                    marginTop: 4
                }, children: filtered.map((o, idx) => (_jsx("div", { style: { padding: "8px 10px", cursor: "pointer", background: idx === active ? "#eff6ff" : "white" }, onMouseEnter: () => setActive(idx), onMouseDown: (e) => e.preventDefault(), onClick: () => {
                        onChange(o.value);
                        onSelectOption?.(o);
                        setOpen(false);
                    }, children: _jsx("span", { style: { fontWeight: idx === active ? 700 : 400 }, children: o.label }) }, o.value))) }))] }));
}
