import MockProtectedRoute from '@/components/MockProtectedRoute'
import DashboardContent from '@/components/DashboardContent'

export default function Dashboard() {
  return (
    <MockProtectedRoute>
      <DashboardContent />
    </MockProtectedRoute>
  )
}