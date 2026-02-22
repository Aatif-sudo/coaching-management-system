import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { AdminDashboardPage } from "./pages/AdminDashboard";
import { AttendancePage } from "./pages/Attendance";
import { BatchesPage } from "./pages/Batches";
import { FeesPage } from "./pages/Fees";
import { LoginPage } from "./pages/Login";
import { NotesPage } from "./pages/Notes";
import { StudentDashboardPage } from "./pages/StudentDashboard";
import { StudentsPage } from "./pages/Students";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user.role === "STUDENT" ? "/student" : "/admin"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<ProtectedRoute roles={["ADMIN", "TEACHER"]} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/batches" element={<BatchesPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/fees" element={<FeesPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["STUDENT"]} />}>
            <Route path="/student" element={<StudentDashboardPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

