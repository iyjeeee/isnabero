import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider } from "@/providers/AuthProvider";
import { PageFallback } from "@/components/PageFallback";
import { RouteGuard } from "@/components/RouteGuard";
import { SetupRedirect } from "@/components/setup/SetupRedirect";
import { OfflineCacheGuard } from "@/components/OfflineCacheGuard";
import { UiLabelsBridge } from "@/providers/UiLabelsBridge";

// Route-based code splitting: each page becomes its own chunk, loaded on first visit instead of all
// bundled into the initial download. Cuts the single large bundle down considerably on first paint.
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage"));
const SetPasswordPage = lazy(() => import("@/pages/SetPasswordPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const CashClosePage = lazy(() => import("@/pages/CashClosePage"));
const EmployeesPage = lazy(() => import("@/pages/EmployeesPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const CatalogPage = lazy(() => import("@/pages/CatalogPage"));
const PosPage = lazy(() => import("@/pages/PosPage"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const InventoryPage = lazy(() => import("@/pages/InventoryPage"));
const SchedulePage = lazy(() => import("@/pages/SchedulePage"));
const AuditLogPage = lazy(() => import("@/pages/AuditLogPage"));

export default function App() {
  return (
    <UiLabelsBridge>
    <AuthProvider>
      <OfflineCacheGuard />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              {/* Business Setup is a modal now; the old page address opens it over the dashboard */}
              <Route path="setup" element={<SetupRedirect />} />
              <Route index element={<DashboardPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="cash-close" element={<CashClosePage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="audit" element={<RouteGuard permission="audit.view"><AuditLogPage /></RouteGuard>} />
              <Route path="catalog" element={<RouteGuard moduleKey="catalog"><CatalogPage /></RouteGuard>} />
              <Route path="pos" element={<RouteGuard moduleKey="pos"><PosPage /></RouteGuard>} />
              <Route path="customers" element={<RouteGuard moduleKey="booking"><CustomersPage /></RouteGuard>} />
              <Route path="booking" element={<RouteGuard moduleKey="booking"><BookingPage /></RouteGuard>} />
              <Route path="inventory" element={<RouteGuard moduleKey="inventory"><InventoryPage /></RouteGuard>} />
              <Route path="schedule" element={<RouteGuard moduleKey="scheduling"><SchedulePage /></RouteGuard>} />
              <Route path="expenses" element={<RouteGuard moduleKey="expenses"><ExpensesPage /></RouteGuard>} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
    </UiLabelsBridge>
  );
}
