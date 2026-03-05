import React from "react";

type Props = {
  title: string;
  value: string;
  trend?: string;
  tone?: "primary" | "success" | "warning" | "danger";
};

export default function KpiCard({ title, value, trend, tone = "primary" }: Props) {
  return (
    <div className={`card kpi kpi-${tone}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {trend && <div className="kpi-trend">{trend}</div>}
    </div>
  );
}
