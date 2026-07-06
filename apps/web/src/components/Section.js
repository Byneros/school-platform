import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Section({ title, action, children }) {
    return (_jsxs("section", { className: "section", children: [_jsxs("div", { className: "section-head", children: [_jsx("h3", { className: "section-title", children: title }), action] }), children] }));
}
