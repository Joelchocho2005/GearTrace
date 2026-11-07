import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Layout from './components/Layout'
import InventoryList from './components/Inventory/InventoryList'
import UsersList from './components/Users/UsersList'
import SuppliersList from './components/Suppliers/SuppliersList'
import WorkOrdersBoard from './components/WorkOrders/WorkOrdersBoard'
import AuditLogs from './components/AuditLogs'
import RoleProtectedRoute from './components/RoleProtectedRoute'

function App() {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} 
      />
      
      <Route 
        path="/" 
        element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
      >
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route
          path="inventory"
          element={
            <RoleProtectedRoute allowedRoles={['GERENTE', 'MECANICO']}>
              <InventoryList />
            </RoleProtectedRoute>
          }
        />
        <Route path="logs" element={<AuditLogs />} />
        <Route
          path="suppliers"
          element={user?.role === 'GERENTE' || user?.role === 'MECANICO' ? <SuppliersList /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="work-orders"
          element={user?.role === 'GERENTE' || user?.role === 'MECANICO' ? <WorkOrdersBoard /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="users"
          element={
            <RoleProtectedRoute allowedRoles={['GERENTE']}>
              <UsersList />
            </RoleProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
    </Routes>
  )
}

export default App
