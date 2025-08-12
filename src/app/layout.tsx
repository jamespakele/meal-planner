import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import ErrorBoundary from '@/components/ErrorBoundary'
import SupabaseMonitorDashboard from '@/components/SupabaseMonitorDashboard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Meal Planner MVP',
  description: 'Group-based meal planning with collaborative decision-making',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-gray-900`}>
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
          <SupabaseMonitorDashboard refreshInterval={3000} compact={true} />
        </ErrorBoundary>
      </body>
    </html>
  )
}