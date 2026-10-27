import { lazy, Suspense } from 'react'

const AdminApp = lazy(() => import('./AdminApp.jsx'))
const AdminEditor = lazy(() => import('./AdminEditor.jsx'))

function AdminRoute() {
  return (
    <Suspense fallback={<p className="admin-boot">Opening admin sign in...</p>}>
      <AdminApp />
    </Suspense>
  )
}

export function InlineAdminRoute() {
  return (
    <Suspense fallback={<p className="admin-boot">Opening admin mode...</p>}>
      <AdminEditor />
    </Suspense>
  )
}

export default AdminRoute
