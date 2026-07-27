import React, { useEffect, useMemo, useState } from "react";

import useSuggestions from "../hooks/useSuggestions";

import Autocomplete from "./Autocomplete";

type Column = { key: string; label: string; sticky?: boolean };

type Props = {
  columns: Column[];
  rows: Record<string, React.ReactNode>[];
  emptyText?: string;
  enableSearch?: boolean;
  pageSize?: number;
  rowKey?: string;
  rowStyle?: (row: Record<string, React.ReactNode>) => React.CSSProperties | undefined;
  suggestionsEndpoint?: string;
  suggestionsLimit?: number;
};

export default function DataTable({
  columns,
  rows,
  emptyText = "Sin datos",
  enableSearch = false,
  pageSize = 5,
  rowKey,
  rowStyle,
  suggestionsEndpoint,
  suggestionsLimit,
}: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!enableSearch || !query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => {
        const value = r[c.key];
        if (typeof value === "string" || typeof value === "number") {
          return String(value).toLowerCase().includes(q);
        }
        return false;
      })
    );
  }, [rows, query, enableSearch, columns]);

  const localSuggestionOptions = useMemo(() => {
    if (!enableSearch) return [];
    const map = new Map<string, { value: string; label: string }>();
    rows.forEach((row) => {
      columns.forEach((col) => {
        const value = row[col.key];
        if (typeof value === "string" || typeof value === "number") {
          const text = String(value).trim();
          if (!text) return;
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
    limit: suggestionsLimit,
  });

  const suggestionOptions = suggestionsEndpoint ? remoteSuggestionOptions : localSuggestionOptions;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, rows.length]);

  return (
    <div>
      {enableSearch && (
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <Autocomplete
            className="input"
            placeholder="Buscar..."
            value={query}
            options={suggestionOptions}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
          />
          <div style={{ minWidth: 140, alignSelf: "center", color: "#64748b" }}>
            {filtered.length} resultados
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={
                    c.sticky
                      ? {
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: "#fff",
                          boxShadow: "2px 0 0 rgba(226,232,240,0.9)",
                        }
                      : undefined
                  }
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  {emptyText}
                </td>
              </tr>
            )}
            {paged.map((row, i) => (
              <tr
                key={rowKey ? String(row[rowKey]) : i}
                style={rowStyle ? rowStyle(row) : undefined}
              >
                {columns.map((c) => {
                  const value = row[c.key];
                  if (c.key === "status" && typeof value === "string") {
                    const norm = value.toLowerCase();
                    return (
                      <td
                        key={c.key}
                        style={
                          c.sticky
                            ? {
                                position: "sticky",
                                left: 0,
                                zIndex: 1,
                                background: "#fff",
                                boxShadow: "2px 0 0 rgba(226,232,240,0.9)",
                              }
                            : undefined
                        }
                      >
                        <span className={`status-badge status-${norm}`}>{value}</span>
                      </td>
                    );
                  }
                  if ((c.key === "grade" || c.key === "course") && typeof value === "string") {
                    return (
                      <td
                        key={c.key}
                        style={
                          c.sticky
                            ? {
                                position: "sticky",
                                left: 0,
                                zIndex: 1,
                                background: "#fff",
                                boxShadow: "2px 0 0 rgba(226,232,240,0.9)",
                              }
                            : undefined
                        }
                      >
                        <span className="tag">{value}</span>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c.key}
                      style={
                        c.sticky
                          ? {
                              position: "sticky",
                              left: 0,
                              zIndex: 1,
                              background: "#fff",
                              boxShadow: "2px 0 0 rgba(226,232,240,0.9)",
                            }
                          : undefined
                      }
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button
          className="button secondary"
          disabled={safePage <= 1}
          onClick={() => setPage(safePage - 1)}
        >
          Anterior
        </button>
        <div style={{ alignSelf: "center", color: "#64748b" }}>
          Pagina {safePage} de {totalPages}
        </div>
        <button
          className="button secondary"
          disabled={safePage >= totalPages}
          onClick={() => setPage(safePage + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
