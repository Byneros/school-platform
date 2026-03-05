import React, { useMemo, useState } from "react";

type Option = { value: string; label: string };

type Props = {
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
};

export default function Autocomplete({ value, options, placeholder, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = value.toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
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
              setOpen(false);
            }
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 8,
            width: "100%",
            boxShadow: "var(--shadow)",
            marginTop: 4
          }}
        >
          {filtered.map((o, idx) => (
            <div
              key={o.value}
              style={{ padding: "8px 10px", cursor: "pointer", background: idx === active ? "#eff6ff" : "white" }}
              onMouseEnter={() => setActive(idx)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span style={{ fontWeight: idx === active ? 700 : 400 }}>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
