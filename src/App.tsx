import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Suspense, lazy, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

// Lazy-load route screens so offline mode doesn't eagerly import cloud-only modules.
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

// Admin
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const BusManagement = lazy(() => import("@/pages/admin/BusManagement"));
const DriverManagement = lazy(() => import("@/pages/admin/DriverManagement"));
const RouteManagement = lazy(() => import("@/pages/admin/RouteManagement"));
const ScheduleManagement = lazy(() => import("@/pages/admin/ScheduleManagement"));
const TripManagement = lazy(() => import("@/pages/admin/TripManagement"));
const ExpenseApproval = lazy(() => import("@/pages/admin/ExpenseApproval"));
const StockManagement = lazy(() => import("@/pages/admin/StockManagement"));
const ProfitabilityReport = lazy(() => import("@/pages/admin/ProfitabilityReport"));
const GSTReport = lazy(() => import("@/pages/admin/GSTReport"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const RepairOrganizations = lazy(() => import("@/pages/admin/RepairOrganizations"));
const RepairRecords = lazy(() => import("@/pages/admin/RepairRecords"));
const InvoiceManagement = lazy(() => import("@/pages/admin/InvoiceManagement"));
const Analytics = lazy(() => import("@/pages/admin/Analytics"));

// Driver
const DriverDashboard = lazy(() => import("@/pages/driver/DriverDashboard"));
const DriverTrips = lazy(() => import("@/pages/driver/DriverTrips"));
const DriverExpenses = lazy(() => import("@/pages/driver/DriverExpenses"));
const DriverProfile = lazy(() => import("@/pages/driver/DriverProfile"));

// Repair
const RepairDashboard = lazy(() => import("@/pages/repair/RepairDashboard"));

const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const FullscreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const suspense = (node: ReactNode) => (
  <Suspense fallback={<FullscreenLoader />}>{node}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={suspense(<Login />)} />
            <Route path="/signup" element={suspense(<Signup />)} />
            <Route path="/dashboard" element={suspense(<ProtectedRoute><Dashboard /></ProtectedRoute>)} />
            {/* Admin Routes */}
            <Route path="/admin" element={suspense(<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>)} />
            <Route path="/admin/buses" element={suspense(<ProtectedRoute requiredRole="admin"><BusManagement /></ProtectedRoute>)} />
            <Route path="/admin/drivers" element={suspense(<ProtectedRoute requiredRole="admin"><DriverManagement /></ProtectedRoute>)} />
            <Route path="/admin/routes" element={suspense(<ProtectedRoute requiredRole="admin"><RouteManagement /></ProtectedRoute>)} />
            <Route path="/admin/schedules" element={suspense(<ProtectedRoute requiredRole="admin"><ScheduleManagement /></ProtectedRoute>)} />
            <Route path="/admin/trips" element={suspense(<ProtectedRoute requiredRole="admin"><TripManagement /></ProtectedRoute>)} />
            <Route path="/admin/expenses" element={suspense(<ProtectedRoute requiredRole="admin"><ExpenseApproval /></ProtectedRoute>)} />
            <Route path="/admin/invoices" element={suspense(<ProtectedRoute requiredRole="admin"><InvoiceManagement /></ProtectedRoute>)} />
            <Route path="/admin/stock" element={suspense(<ProtectedRoute requiredRole="admin"><StockManagement /></ProtectedRoute>)} />
            <Route path="/admin/profitability" element={suspense(<ProtectedRoute requiredRole="admin"><ProfitabilityReport /></ProtectedRoute>)} />
            <Route path="/admin/gst-report" element={suspense(<ProtectedRoute requiredRole="admin"><GSTReport /></ProtectedRoute>)} />
            <Route path="/admin/settings" element={suspense(<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>)} />
            <Route path="/admin/repair-organizations" element={suspense(<ProtectedRoute requiredRole="admin"><RepairOrganizations /></ProtectedRoute>)} />
            <Route path="/admin/repair-records" element={suspense(<ProtectedRoute requiredRole="admin"><RepairRecords /></ProtectedRoute>)} />
            <Route path="/admin/analytics" element={suspense(<ProtectedRoute requiredRole="admin"><Analytics /></ProtectedRoute>)} />
            {/* Driver Routes */}
            <Route path="/driver" element={suspense(<ProtectedRoute requiredRole="driver"><DriverDashboard /></ProtectedRoute>)} />
            <Route path="/driver/trips" element={suspense(<ProtectedRoute requiredRole="driver"><DriverTrips /></ProtectedRoute>)} />
            <Route path="/driver/expenses" element={suspense(<ProtectedRoute requiredRole="driver"><DriverExpenses /></ProtectedRoute>)} />
            <Route path="/driver/profile" element={suspense(<ProtectedRoute requiredRole="driver"><DriverProfile /></ProtectedRoute>)} />
            {/* Repair Org Routes */}
            <Route path="/repair" element={suspense(<ProtectedRoute requiredRole="repair_org"><RepairDashboard /></ProtectedRoute>)} />
            <Route path="*" element={suspense(<NotFound />)} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
