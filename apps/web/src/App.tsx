import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/providers/AuthProvider";
import { PageFallback } from "@/components/PageFallback";
import { RouteGuard } from "@/components/RouteGuard";
import { SetupGate } from "@/components/SetupGate";

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
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const AuditLogPage = lazy(() => import("@/pages/AuditLogPage"));
const SetupPage = lazy(() => import("@/pages/SetupPage"));

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              {/* setup sits outside SetupGate so the first-run redirect can't loop */}
              <Route
                path="setup"
                element={
                  <RouteGuard permission="business.configure">
                    <SetupPage />
                  </RouteGuard>
                }
              />
              <Route element={<SetupGate />}>
                <Route index element={<DashboardPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="audit" element={<RouteGuard permission="audit.view"><AuditLogPage /></RouteGuard>} />
                <Route path="catalog" element={<RouteGuard moduleKey="catalog"><CatalogPage /></RouteGuard>} />
                <Route path="pos" element={<RouteGuard moduleKey="pos"><PosPage /></RouteGuard>} />
                <Route path="booking" element={<RouteGuard moduleKey="booking"><BookingPage /></RouteGuard>} />
                <Route path="expenses" element={<RouteGuard moduleKey="expenses"><ExpensesPage /></RouteGuard>} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
