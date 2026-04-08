import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles.css";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAlerts from "./pages/AdminAlerts";
import TeacherDashboard from "./pages/TeacherDashboard";
import ParentDashboard from "./pages/ParentDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminAdmissions from "./pages/AdminAdmissions";
import AdminFinance from "./pages/AdminFinance";
import AdminNotifications from "./pages/AdminNotifications";
import AdminBranding from "./pages/AdminBranding";
import AdminTeacherHours from "./pages/AdminTeacherHours";
import AdminCertificates from "./pages/AdminCertificates";
import AdminAcademicClosure from "./pages/AdminAcademicClosure";
import TeacherAttendance from "./pages/TeacherAttendance";
import TeacherComms from "./pages/TeacherComms";
import TeacherTasks from "./pages/TeacherTasks";
import TeacherGrades from "./pages/TeacherGrades";
import ParentBoletines from "./pages/ParentBoletines";
import ParentPagos from "./pages/ParentPagos";
import ParentComunicados from "./pages/ParentComunicados";
import StudentFollowup from "./pages/StudentFollowup";
import SessionsPage from "./pages/SessionsPage";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<LoginPage />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/alertas"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminAlerts />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/usuarios"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/admisiones"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminAdmissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/finanzas"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminFinance />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/notificaciones"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/horas-docentes"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminTeacherHours />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/asistencia"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <TeacherAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/seguimiento-estudiantil"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <StudentFollowup />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/observador"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <StudentFollowup />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/personalizacion"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminBranding />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/certificados"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminCertificates />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/cierre-academico"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminAcademicClosure />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/sesiones"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <SessionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/asistencia"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <TeacherAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/calificaciones"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <TeacherGrades />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/tareas-calificaciones"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <TeacherTasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/comunicaciones"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <TeacherComms />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/sesiones"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <SessionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/seguimiento-estudiantil"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <StudentFollowup />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/observador"
              element={
                <ProtectedRoute roles={["TEACHER"]}>
                  <StudentFollowup />
                </ProtectedRoute>
              }
            />
            <Route
              path="parent"
              element={
                <ProtectedRoute roles={["PARENT"]}>
                  <ParentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="parent/boletines"
              element={
                <ProtectedRoute roles={["PARENT"]}>
                  <ParentBoletines />
                </ProtectedRoute>
              }
            />
            <Route
              path="parent/pagos"
              element={
                <ProtectedRoute roles={["PARENT"]}>
                  <ParentPagos />
                </ProtectedRoute>
              }
            />
            <Route
              path="parent/comunicados"
              element={
                <ProtectedRoute roles={["PARENT"]}>
                  <ParentComunicados />
                </ProtectedRoute>
              }
            />
            <Route
              path="parent/sesiones"
              element={
                <ProtectedRoute roles={["PARENT"]}>
                  <SessionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="parent/seguimiento-estudiantil"
              element={
                <ProtectedRoute roles={["PARENT"]}>
                  <StudentFollowup />
                </ProtectedRoute>
              }
            />
            <Route
              path="parent/observador"
              element={
                <ProtectedRoute roles={["PARENT"]}>
                  <StudentFollowup />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
