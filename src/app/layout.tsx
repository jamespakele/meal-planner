import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MockAuthProvider } from '@/components/MockAuthProvider'

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
      <body className={inter.className}>
        <MockAuthProvider>{children}</MockAuthProvider>
      </body>
    </html>
  )
}