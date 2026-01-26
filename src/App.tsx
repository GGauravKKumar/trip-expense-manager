import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import BusManagement from "@/pages/admin/BusManagement";
import DriverManagement from "@/pages/admin/DriverManagement";
import RouteManagement from "@/pages/admin/RouteManagement";
import ScheduleManagement from "@/pages/admin/ScheduleManagement";
import TripManagement from "@/pages/admin/TripManagement";
import ExpenseApproval from "@/pages/admin/ExpenseApproval";
import StockManagement from "@/pages/admin/StockManagement";
import ProfitabilityReport from "@/pages/admin/ProfitabilityReport";
import GSTReport from "@/pages/admin/GSTReport";
import AdminSettings from "@/pages/admin/Settings";
import RepairOrganizations from "@/pages/admin/RepairOrganizations";
import RepairRecords from "@/pages/admin/RepairRecords";
import InvoiceManagement from "@/pages/admin/InvoiceManagement";
import DriverDashboard from "@/pages/driver/DriverDashboard";
import DriverTrips from "@/pages/driver/DriverTrips";
import DriverExpenses from "@/pages/driver/DriverExpenses";
import DriverProfile from "@/pages/driver/DriverProfile";
import RepairDashboard from "@/pages/repair/RepairDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/buses" element={<ProtectedRoute requiredRole="admin"><BusManagement /></ProtectedRoute>} />
            <Route path="/admin/drivers" element={<ProtectedRoute requiredRole="admin"><DriverManagement /></ProtectedRoute>} />
            <Route path="/admin/routes" element={<ProtectedRoute requiredRole="admin"><RouteManagement /></ProtectedRoute>} />
            <Route path="/admin/schedules" element={<ProtectedRoute requiredRole="admin"><ScheduleManagement /></ProtectedRoute>} />
            <Route path="/admin/trips" element={<ProtectedRoute requiredRole="admin"><TripManagement /></ProtectedRoute>} />
            <Route path="/admin/expenses" element={<ProtectedRoute requiredRole="admin"><ExpenseApproval /></ProtectedRoute>} />
            <Route path="/admin/invoices" element={<ProtectedRoute requiredRole="admin"><InvoiceManagement /></ProtectedRoute>} />
            <Route path="/admin/stock" element={<ProtectedRoute requiredRole="admin"><StockManagement /></ProtectedRoute>} />
            <Route path="/admin/profitability" element={<ProtectedRoute requiredRole="admin"><ProfitabilityReport /></ProtectedRoute>} />
            <Route path="/admin/gst-report" element={<ProtectedRoute requiredRole="admin"><GSTReport /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/repair-organizations" element={<ProtectedRoute requiredRole="admin"><RepairOrganizations /></ProtectedRoute>} />
            <Route path="/admin/repair-records" element={<ProtectedRoute requiredRole="admin"><RepairRecords /></ProtectedRoute>} />
            {/* Driver Routes */}
            <Route path="/driver" element={<ProtectedRoute requiredRole="driver"><DriverDashboard /></ProtectedRoute>} />
            <Route path="/driver/trips" element={<ProtectedRoute requiredRole="driver"><DriverTrips /></ProtectedRoute>} />
            <Route path="/driver/expenses" element={<ProtectedRoute requiredRole="driver"><DriverExpenses /></ProtectedRoute>} />
            <Route path="/driver/profile" element={<ProtectedRoute requiredRole="driver"><DriverProfile /></ProtectedRoute>} />
            {/* Repair Org Routes */}
            <Route path="/repair" element={<ProtectedRoute requiredRole="repair_org"><RepairDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
