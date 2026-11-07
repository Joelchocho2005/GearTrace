import { ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Layout from './components/Layout'
import InventoryList from './components/Inventory/InventoryList'
import AuditLogs from './components/AuditLogs'
import RoleProtectedRoute from './components/RoleProtectedRoute'
import UsuariosPage from './pages/UsuariosPage'
import VehiculosPage from './pages/VehiculosPage'
import OrdenesTrabajoPage from './pages/OrdenesTrabajoPage'
import CitasPage from './pages/CitasPage'
import ProveedoresPage from './pages/ProveedoresPage'
import ComprasPage from './pages/ComprasPage'
import FacturacionPage from './pages/FacturacionPage'
import { AppRoute, ROUTE_ROLES } from './routes/routeRoles'

/** Vista de cada ruta protegida; los roles salen de ROUTE_ROLES. */
const protectedRoutes: Record<AppRoute, ReactNode> = {
  inventory: <InventoryList />,
  // Administración
  usuarios: <UsuariosPage />,
  // Servicios (SER)
  vehiculos: <VehiculosPage />,
  'ordenes-trabajo': <OrdenesTrabajoPage />,
  citas: <CitasPage />,
  // Abastecimiento (ABA)
  proveedores: <ProveedoresPage />,
  compras: <ComprasPage />,
  // Facturación (FIN)
  facturacion: <FacturacionPage />,
}

/** Rutas anteriores en inglés: redirigen a la ruta canónica en español. */
const legacyRedirects: Record<string, string> = {
  users: '/usuarios',
  'work-orders': '/ordenes-trabajo',
  suppliers: '/proveedores',
  billing: '/facturacion',
}

function App() {
  const { isAuthenticated, isLoading } = useAuth()

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
        <Route path="logs" element={<AuditLogs />} />

        {(Object.keys(protectedRoutes) as AppRoute[]).map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <RoleProtectedRoute allowedRoles={[...ROUTE_ROLES[path]]}>
                {protectedRoutes[path]}
              </RoleProtectedRoute>
            }
          />
        ))}

        {Object.entries(legacyRedirects).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
    </Routes>
  )
}

export default App
