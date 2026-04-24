import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ActionFeedback from "../components/ActionFeedback";

type FeedbackItem = {
  id: string;
  category: "OPINION" | "BUG" | "SUGGESTION";
  title: string;
  message: string;
  status: "OPEN" | "REVIEWED" | "CLOSED";
  response?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
    role: string;
  };
};

const categoryLabel: Record<string, string> = {
  OPINION: "Opinion",
  BUG: "Error",
  SUGGESTION: "Sugerencia"
};

const statusLabel: Record<string, string> = {
  OPEN: "Abierto",
  REVIEWED: "Revisado",
  CLOSED: "Cerrado"
};

export default function FeedbackCenter() {
  const { user } = useAuth();
  const isDeveloper = user?.role === "DEVELOPER";
  const [mine, setMine] = useState<FeedbackItem[]>([]);
  const [all, setAll] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    category: "SUGGESTION",
    title: "",
    message: ""
  });
  const [responses, setResponses] = useState<Record<string, { status: string; response: string }>>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const mineRes = await apiGet("/feedback/mine");
      setMine(mineRes?.data || []);
      if (isDeveloper) {
        const allRes = await apiGet("/feedback");
        setAll(allRes?.data || []);
      } else {
        setAll([]);
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar el feedback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isDeveloper]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiPost("/feedback", form);
      setForm({ category: "SUGGESTION", title: "", message: "" });
      setMessage("Comentario registrado correctamente.");
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar el comentario.");
    } finally {
      setSaving(false);
    }
  };

  const respond = async (id: string) => {
    const current = responses[id];
    if (!current?.response?.trim()) return;
    setSaving(true);
    setError("");
    try {
      await apiPatch(`/feedback/${id}/respond`, {
        status: current.status,
        response: current.response
      });
      setMessage("Respuesta guardada.");
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo responder el feedback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form className="card" onSubmit={submit}>
        <div className="section-title">Comentarios y feedback</div>
        <div style={{ color: "#64748b", marginBottom: 10 }}>
          Comparte opiniones, reporta errores o deja sugerencias para mejorar el sistema.
        </div>
        <label>
          Tipo
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          >
            <option value="SUGGESTION">Sugerencia</option>
            <option value="BUG">Error</option>
            <option value="OPINION">Opinion</option>
          </select>
        </label>
        <label>
          Titulo
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Resume tu comentario"
          />
        </label>
        <label>
          Mensaje
          <textarea
            className="input"
            rows={5}
            value={form.message}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Describe con detalle lo que quieres reportar"
          />
        </label>
        <ActionFeedback
          tone="error"
          title="Error en feedback"
          message={error}
          onDismiss={() => setError("")}
          style={{ marginTop: 8, marginBottom: 0 }}
        />
        <ActionFeedback
          tone="success"
          title="Feedback registrado"
          message={message}
          onDismiss={() => setMessage("")}
          style={{ marginTop: 8, marginBottom: 0 }}
        />
        <button className="button" type="submit" disabled={saving} style={{ marginTop: 12 }}>
          {saving ? "Enviando..." : "Registrar feedback"}
        </button>
      </form>

      <div className="card">
        <div className="section-title">Mis comentarios</div>
        {loading ? (
          <div style={{ color: "#64748b" }}>Cargando...</div>
        ) : mine.length === 0 ? (
          <div style={{ color: "#64748b" }}>Todavia no has registrado comentarios.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {mine.map((item) => (
              <div key={item.id} className="card" style={{ boxShadow: "none" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span className="badge">{categoryLabel[item.category] || item.category}</span>
                  <span className="badge">{statusLabel[item.status] || item.status}</span>
                </div>
                <div style={{ fontWeight: 700 }}>{item.title}</div>
                <div style={{ color: "#475569", whiteSpace: "pre-wrap", marginTop: 6 }}>{item.message}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
                  Registrado: {String(item.createdAt || "").slice(0, 19).replace("T", " ")}
                </div>
                {item.response && (
                  <div style={{ marginTop: 10, padding: 10, background: "#f8fafc", borderRadius: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Respuesta del sistema/equipo</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{item.response}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isDeveloper && (
        <div className="card">
          <div className="section-title">Bandeja global de feedback</div>
          {all.length === 0 ? (
            <div style={{ color: "#64748b" }}>No hay comentarios globales.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {all.map((item) => {
                const current = responses[item.id] || {
                  status: item.status,
                  response: item.response || ""
                };
                return (
                  <div key={item.id} className="card" style={{ boxShadow: "none" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <span className="badge">{categoryLabel[item.category] || item.category}</span>
                      <span className="badge">{statusLabel[item.status] || item.status}</span>
                      {item.user && <span className="badge">{item.user.fullName} · {item.user.role}</span>}
                    </div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ color: "#475569", whiteSpace: "pre-wrap", marginTop: 6 }}>{item.message}</div>
                    {item.user && (
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
                        {item.user.email}
                      </div>
                    )}
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <select
                        className="input"
                        value={current.status}
                        onChange={(e) =>
                          setResponses((prev) => ({
                            ...prev,
                            [item.id]: { ...current, status: e.target.value }
                          }))
                        }
                      >
                        <option value="OPEN">Abierto</option>
                        <option value="REVIEWED">Revisado</option>
                        <option value="CLOSED">Cerrado</option>
                      </select>
                      <textarea
                        className="input"
                        rows={4}
                        value={current.response}
                        onChange={(e) =>
                          setResponses((prev) => ({
                            ...prev,
                            [item.id]: { ...current, response: e.target.value }
                          }))
                        }
                        placeholder="Respuesta interna o para el usuario"
                      />
                      <button className="button secondary" type="button" onClick={() => respond(item.id)} disabled={saving}>
                        Guardar respuesta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
