import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import Autocomplete from "./Autocomplete";
import useSuggestions from "../hooks/useSuggestions";
export default function DataTable({ columns, rows, emptyText = "Sin datos", enableSearch = false, pageSize = 5, rowKey, rowStyle, suggestionsEndpoint, suggestionsLimit }) {
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const filtered = useMemo(() => {
        if (!enableSearch || !query.trim())
            return rows;
        const q = query.toLowerCase();
        return rows.filter((r) => columns.some((c) => {
            const value = r[c.key];
            if (typeof value === "string" || typeof value === "number") {
                return String(value).toLowerCase().includes(q);
            }
            return false;
        }));
    }, [rows, query, enableSearch, columns]);
    const localSuggestionOptions = useMemo(() => {
        if (!enableSearch)
            return [];
        const map = new Map();
        rows.forEach((row) => {
            columns.forEach((col) => {
                const value = row[col.key];
                if (typeof value === "string" || typeof value === "number") {
                    const text = String(value).trim();
                    if (!text)
                        return;
                    const key = `${col.key}:${text}`;
                    if (!map.has(key)) {
                        map.set(key, { value: text, label: col.label ? `${col.label}: ${text}` : text });
                    }
                }
            });
        });
        return Array.from(map.values());
    }, [rows, columns, enableSearch]);
    const remoteSuggestionOptions = useSuggestions({
        endpoint: suggestionsEndpoint || "",
        query,
        enabled: Boolean(enableSearch && suggestionsEndpoint),
        limit: suggestionsLimit
    });
    const suggestionOptions = suggestionsEndpoint ? remoteSuggestionOptions : localSuggestionOptions;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);
    useEffect(() => {
        setPage(1);
    }, [query, rows.length]);
    return (_jsxs("div", { children: [enableSearch && (_jsxs("div", { style: { display: "flex", gap: 12, marginBottom: 10 }, children: [_jsx(Autocomplete, { className: "input", placeholder: "Buscar...", value: query, options: suggestionOptions, onChange: (value) => {
                            setQuery(value);
                            setPage(1);
                        } }), _jsxs("div", { style: { minWidth: 140, alignSelf: "center", color: "#64748b" }, children: [filtered.length, " resultados"] })] })), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => (_jsx("th", { style: c.sticky
                                        ? {
                                            position: "sticky",
                                            left: 0,
                                            zIndex: 2,
                                            background: "#fff",
                                            boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                                        }
                                        : undefined, children: c.label }, c.key))) }) }), _jsxs("tbody", { children: [paged.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, className: "table-empty", children: emptyText }) })), paged.map((row, i) => (_jsx("tr", { style: rowStyle ? rowStyle(row) : undefined, children: columns.map((c) => {
                                        const value = row[c.key];
                                        if (c.key === "status" && typeof value === "string") {
                                            const norm = value.toLowerCase();
                                            return (_jsx("td", { style: c.sticky
                                                    ? {
                                                        position: "sticky",
                                                        left: 0,
                                                        zIndex: 1,
                                                        background: "#fff",
                                                        boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                                                    }
                                                    : undefined, children: _jsx("span", { className: `status-badge status-${norm}`, children: value }) }, c.key));
                                        }
                                        if ((c.key === "grade" || c.key === "course") && typeof value === "string") {
                                            return (_jsx("td", { style: c.sticky
                                                    ? {
                                                        position: "sticky",
                                                        left: 0,
                                                        zIndex: 1,
                                                        background: "#fff",
                                                        boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                                                    }
                                                    : undefined, children: _jsx("span", { className: "tag", children: value }) }, c.key));
                                        }
                                        return (_jsx("td", { style: c.sticky
                                                ? {
                                                    position: "sticky",
                                                    left: 0,
                                                    zIndex: 1,
                                                    background: "#fff",
                                                    boxShadow: "2px 0 0 rgba(226,232,240,0.9)"
                                                }
                                                : undefined, children: value }, c.key));
                                    }) }, rowKey ? String(row[rowKey]) : i)))] })] }) }), _jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }, children: [_jsx("button", { className: "button secondary", disabled: safePage <= 1, onClick: () => setPage(safePage - 1), children: "Anterior" }), _jsxs("div", { style: { alignSelf: "center", color: "#64748b" }, children: ["Pagina ", safePage, " de ", totalPages] }), _jsx("button", { className: "button secondary", disabled: safePage >= totalPages, onClick: () => setPage(safePage + 1), children: "Siguiente" })] })] }));
}
