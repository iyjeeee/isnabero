import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/providers/AuthProvider";

// Route-based code splitting: each page becomes its own chunk, loaded on first visit instead of all
// bundled into the initial download. Cuts the single large bundle down considerably on first paint.
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage"));
const EmployeesPage = lazy(() => import("@/pages/EmployeesPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const CatalogPage = lazy(() => import("@/pages/CatalogPage"));
const PosPage = lazy(() => import("@/pages/PosPage"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));

function PageFallback() {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="pos" element={<PosPage />} />
              <Route path="booking" element={<BookingPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
