import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function KpiCard({ title, value, trend, tone = "primary", onClick }) {
    return (_jsxs("div", { className: `card kpi kpi-${tone}`, style: onClick ? { cursor: "pointer" } : undefined, onClick: onClick, role: onClick ? "button" : undefined, tabIndex: onClick ? 0 : undefined, onKeyDown: onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ")
                    onClick();
            }
            : undefined, children: [_jsx("div", { className: "kpi-title", children: title }), _jsx("div", { className: "kpi-value", children: value }), trend && _jsx("div", { className: "kpi-trend", children: trend })] }));
}
