'use client'

import Link from 'next/link'
import { BarChart3, Settings, AlertCircle, FileText } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Reconciliation Platform</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/breaks" className="text-gray-700 hover:text-gray-900">
                Breaks
              </Link>
              <Link href="/config" className="text-gray-700 hover:text-gray-900">
                Configuration
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Event-Driven Reconciliation Platform
          </h2>
          <p className="text-xl text-gray-600">
            High-volume financial reconciliation with dynamic configuration
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/dashboard" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <BarChart3 className="w-8 h-8 text-primary-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard</h3>
            <p className="text-gray-600">View KPIs and transaction summaries</p>
          </Link>

          <Link href="/breaks" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <AlertCircle className="w-8 h-8 text-red-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Exception Resolution</h3>
            <p className="text-gray-600">Investigate and resolve breaks</p>
          </Link>

          <Link href="/config" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <Settings className="w-8 h-8 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration</h3>
            <p className="text-gray-600">Manage mappings and rules</p>
          </Link>

          <Link href="/rules" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <FileText className="w-8 h-8 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rule Editor</h3>
            <p className="text-gray-600">Create and deploy matching rules</p>
          </Link>
        </div>
      </main>
    </div>
  )
}

