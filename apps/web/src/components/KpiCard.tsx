import React from "react";

type Props = {
  title: string;
  value: string;
  trend?: string;
  tone?: "primary" | "success" | "warning" | "danger";
  onClick?: () => void;
};

export default function KpiCard({ title, value, trend, tone = "primary", onClick }: Props) {
  return (
    <div
      className={`card kpi kpi-${tone}`}
      style={onClick ? { cursor: "pointer" } : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {trend && <div className="kpi-trend">{trend}</div>}
    </div>
  );
}
