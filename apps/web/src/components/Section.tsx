import React from "react";

type Props = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export default function Section({ title, action, children }: Props) {
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
