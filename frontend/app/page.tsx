'use client'

import Link from 'next/link'
import { BarChart3, Settings, AlertCircle, FileText, TrendingUp, ArrowRight, Users } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl mb-6">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            Reconciliation Platform
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            High-volume financial reconciliation with dynamic configuration and real-time processing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Link 
            href="/dashboard" 
            className="group bg-white rounded-xl shadow-finance p-8 hover:shadow-finance-lg transition-all duration-300 border border-slate-100 hover:border-blue-200"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Dashboard</h3>
            <p className="text-slate-600 text-sm mb-4">View KPIs and transaction summaries</p>
            <div className="flex items-center text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
              View <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link 
            href="/breaks" 
            className="group bg-white rounded-xl shadow-finance p-8 hover:shadow-finance-lg transition-all duration-300 border border-slate-100 hover:border-red-200"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-lg mb-4 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Exception Resolution</h3>
            <p className="text-slate-600 text-sm mb-4">Investigate and resolve breaks</p>
            <div className="flex items-center text-red-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
              View <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link 
            href="/config" 
            className="group bg-white rounded-xl shadow-finance p-8 hover:shadow-finance-lg transition-all duration-300 border border-slate-100 hover:border-indigo-200"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Configuration</h3>
            <p className="text-slate-600 text-sm mb-4">Manage mappings and rules</p>
            <div className="flex items-center text-indigo-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
              View <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link 
            href="/rules" 
            className="group bg-white rounded-xl shadow-finance p-8 hover:shadow-finance-lg transition-all duration-300 border border-slate-100 hover:border-green-200"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-lg mb-4 group-hover:scale-110 transition-transform">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Rule Editor</h3>
            <p className="text-slate-600 text-sm mb-4">Create and deploy matching rules</p>
            <div className="flex items-center text-green-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
              View <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link 
            href="/direla" 
            className="group bg-white rounded-xl shadow-finance p-8 hover:shadow-finance-lg transition-all duration-300 border border-slate-100 hover:border-purple-200"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Direla Multi-Party</h3>
            <p className="text-slate-600 text-sm mb-4">Real-time multi-party reconciliation</p>
            <div className="flex items-center text-purple-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
              View <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}

