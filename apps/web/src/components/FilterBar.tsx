import React from "react";

type Filter = {
  label: string;
  options: string[];
};

type Props = {
  filters: Filter[];
};

export default function FilterBar({ filters }: Props) {
  return (
    <div className="filter-bar">
      {filters.map((f, idx) => (
        <label key={idx} className="filter-item">
          {f.label}
          <select className="input">
            {f.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      ))}
      <button className="button" type="button">Aplicar</button>
    </div>
  );
}
