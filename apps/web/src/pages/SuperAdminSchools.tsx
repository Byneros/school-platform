import { useCallback, useEffect, useState, type FormEvent } from "react";

import ActionFeedback from "../components/ActionFeedback";
import DataTable from "../components/DataTable";
import Section from "../components/Section";
import { apiGet, apiPost } from "../services/api";
import type { ApiError } from "../services/api";

type School = {
  id: string;
  code: string;
  name: string;
  nit?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
};

type CreateSchoolResult = {
  school: School;
  admin: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    schoolId: string;
  };
  credentialsDelivery?: "queued" | "sent" | "failed";
  messages?: string[];
};

const initialForm = {
  code: "",
  name: "",
  nit: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
};

export default function SuperAdminSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSchools = useCallback(() => {
    setLoading(true);
    apiGet<School[]>("/schools")
      .then((res) => setSchools(Array.isArray(res) ? res : []))
      .catch((err) => {
        const apiError = err as ApiError;
        setError(apiError.message || "No fue posible cargar los colegios.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  const updateForm = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const result = await apiPost<CreateSchoolResult>("/schools", {
        school: {
          code: form.code,
          name: form.name,
          nit: form.nit || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          website: form.website || undefined,
        },
        admin: {
          fullName: form.adminFullName,
          email: form.adminEmail,
          password: form.adminPassword,
        },
      });
      setMessage(
        result.messages?.join(" ") ||
          "Colegio creado correctamente. Administrador creado correctamente."
      );
      setForm(initialForm);
      loadSchools();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "No fue posible crear el colegio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <ActionFeedback
        tone="success"
        title="Colegio creado"
        message={message}
        onDismiss={() => setMessage("")}
      />
      <ActionFeedback tone="error" message={error} onDismiss={() => setError("")} />

      <Section title="Colegios">
        <div className="card">
          <DataTable
            enableSearch
            pageSize={8}
            columns={[
              { key: "name", label: "Colegio", sticky: true },
              { key: "code", label: "Codigo" },
              { key: "nit", label: "NIT" },
              { key: "email", label: "Correo" },
              { key: "phone", label: "Telefono" },
              { key: "status", label: "Estado" },
            ]}
            rows={schools.map((school) => ({
              id: school.id,
              name: school.name,
              code: school.code,
              nit: school.nit || "-",
              email: school.email || "-",
              phone: school.phone || "-",
              status: school.isActive ? "Activo" : "Inactivo",
            }))}
            rowKey="id"
            emptyText={loading ? "Cargando colegios..." : "No hay colegios registrados"}
          />
        </div>
      </Section>

      <Section title="Crear colegio y administrador">
        <form className="card" onSubmit={handleSubmit}>
          <div className="grid grid-3">
            <label>
              Codigo
              <input
                className="input"
                value={form.code}
                onChange={(e) => updateForm("code", e.target.value)}
                required
                minLength={2}
                maxLength={20}
              />
            </label>
            <label>
              Nombre del colegio
              <input
                className="input"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                required
                minLength={3}
                maxLength={120}
              />
            </label>
            <label>
              NIT
              <input
                className="input"
                value={form.nit}
                onChange={(e) => updateForm("nit", e.target.value)}
              />
            </label>
            <label>
              Correo institucional
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
              />
            </label>
            <label>
              Telefono
              <input
                className="input"
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
              />
            </label>
            <label>
              Sitio web
              <input
                className="input"
                value={form.website}
                onChange={(e) => updateForm("website", e.target.value)}
              />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>
              Direccion
              <input
                className="input"
                value={form.address}
                onChange={(e) => updateForm("address", e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-3" style={{ marginTop: 16 }}>
            <label>
              Nombre del administrador
              <input
                className="input"
                value={form.adminFullName}
                onChange={(e) => updateForm("adminFullName", e.target.value)}
                required
                minLength={3}
                maxLength={120}
              />
            </label>
            <label>
              Correo del administrador
              <input
                className="input"
                type="email"
                value={form.adminEmail}
                onChange={(e) => updateForm("adminEmail", e.target.value)}
                required
              />
            </label>
            <label>
              Contrasena temporal
              <input
                className="input"
                type="password"
                value={form.adminPassword}
                onChange={(e) => updateForm("adminPassword", e.target.value)}
                required
                minLength={8}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear colegio"}
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
