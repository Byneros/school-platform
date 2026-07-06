import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function FilterBar({ filters }) {
    return (_jsxs("div", { className: "filter-bar", children: [filters.map((f, idx) => (_jsxs("label", { className: "filter-item", children: [f.label, _jsx("select", { className: "input", children: f.options.map((o) => (_jsx("option", { children: o }, o))) })] }, idx))), _jsx("button", { className: "button", type: "button", children: "Aplicar" })] }));
}
