import { lazy, Suspense } from 'react'

const AdminApp = lazy(() => import('./AdminApp.jsx'))

function AdminRoute() {
  return (
    <Suspense fallback={<p className="admin-boot">Opening admin sign in...</p>}>
      <AdminApp />
    </Suspense>
  )
}

export default AdminRoute
