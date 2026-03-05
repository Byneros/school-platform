import KpiCard from "../components/KpiCard";
import Section from "../components/Section";
import DataTable from "../components/DataTable";
import { apiDownload } from "../services/api";
import { gradeOptions } from "../services/grades";

export default function ParentDashboard() {
  const downloadReportCard = async () => {
    const blob = await apiDownload("/reports/report-card/student-1");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boletin-student-1.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card">
        <div className="section-head">
          <div>
            <div className="section-title">Panel de Padres</div>
            <div style={{ color: "#6b7280" }}>Consulta boletines, asistencia y pagos sin complicaciones.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button secondary" onClick={downloadReportCard}>Descargar boletin</button>
            <button className="button">Ver historial</button>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard title="Promedio general" value="17.2" trend="Periodo 1" tone="success" />
        <KpiCard title="Asistencia" value="95%" trend="Ultimos 30 dias" tone="primary" />
        <KpiCard title="Facturas" value="$ 260" trend="1 pendiente" tone="warning" />
        <KpiCard title="Avisos" value="3" trend="Nuevos" tone="danger" />
      </div>

      <div className="grid grid-2">
        <Section
          title="Boletin y notas"
          action={<button className="button secondary" onClick={downloadReportCard}>Descargar</button>}
        >
          <div className="help-card">
            Puedes descargar el boletin en PDF y guardarlo para tus registros.
          </div>
          <DataTable
            enableSearch
            pageSize={5}
            columns={[
              { key: "grade", label: "Grado" },
              { key: "period", label: "Periodo" },
              { key: "score", label: "Nota" }
            ]}
            rows={[
              { grade: gradeOptions.find((g) => g.value === "QUINTO")?.label || "Quinto", period: "P1", score: "17" },
              { grade: gradeOptions.find((g) => g.value === "QUINTO")?.label || "Quinto", period: "P1", score: "18" },
              { grade: gradeOptions.find((g) => g.value === "QUINTO")?.label || "Quinto", period: "P1", score: "16" },
              { grade: gradeOptions.find((g) => g.value === "QUINTO")?.label || "Quinto", period: "P1", score: "17" },
              { grade: gradeOptions.find((g) => g.value === "QUINTO")?.label || "Quinto", period: "P1", score: "19" }
            ]}
          />
        </Section>

        <Section title="Estado financiero" action={<button className="button">Ver detalle</button>}>
          <DataTable
            enableSearch
            pageSize={4}
            columns={[
              { key: "invoice", label: "Factura" },
              { key: "amount", label: "Monto" },
              { key: "status", label: "Estado" }
            ]}
            rows={[
              { invoice: "INV-2031", amount: "$ 260", status: "Pendiente" },
              { invoice: "INV-2029", amount: "$ 260", status: "Pagada" },
              { invoice: "INV-2028", amount: "$ 260", status: "Pagada" },
              { invoice: "INV-2027", amount: "$ 260", status: "Vencida" }
            ]}
          />
        </Section>
      </div>

      <Section title="Comunicados autorizados" action={<button className="button">Ver historial</button>}>
        <DataTable
          enableSearch
          pageSize={5}
          columns={[
            { key: "title", label: "Titulo" },
            { key: "date", label: "Fecha" },
            { key: "status", label: "Estado" }
          ]}
          rows={[
            { title: "Bienvenidos al ciclo 2026", date: "2026-02-06", status: "Enviado" },
            { title: "Reunion de padres", date: "2026-02-02", status: "Enviado" },
            { title: "Recordatorio de pagos", date: "2026-01-28", status: "Enviado" },
            { title: "Entrega de boletines", date: "2026-01-24", status: "Enviado" },
            { title: "Actividades culturales", date: "2026-01-20", status: "Enviado" }
          ]}
        />
      </Section>
    </div>
  );
}
