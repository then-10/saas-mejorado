'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FeatureDef } from '@/lib/features'
import type { ClientFeature } from '@prisma/client'

interface Props {
  clientId: string
  features: FeatureDef[]
  featureMap: Record<string, ClientFeature>
}

export default function FeatureToggles({ clientId, features, featureMap }: Props) {
  const router = useRouter()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [localState, setLocalState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(features.map((f) => [f.key, featureMap[f.key]?.enabled ?? false]))
  )

  async function toggle(featureKey: string) {
    const newValue = !localState[featureKey]
    setLoadingKey(featureKey)
    setLocalState((prev) => ({ ...prev, [featureKey]: newValue }))

    try {
      await fetch(`/api/admin/clientes/${clientId}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, enabled: newValue }),
      })
      router.refresh()
    } catch {
      // revert on error
      setLocalState((prev) => ({ ...prev, [featureKey]: !newValue }))
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {features.map((feature) => {
        const enabled = localState[feature.key]
        const isLoading = loadingKey === feature.key

        return (
          <div
            key={feature.key}
            className={`border rounded-xl p-4 flex items-start gap-3 transition-all ${
              enabled ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${
              enabled ? 'bg-indigo-100' : 'bg-gray-100'
            }`}>
              <FeatureIcon icon={feature.icon} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${enabled ? 'text-indigo-900' : 'text-gray-700'}`}>
                {feature.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{feature.description}</p>
            </div>
            <button
              onClick={() => toggle(feature.key)}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                enabled ? 'bg-indigo-600' : 'bg-gray-300'
              } ${isLoading ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function FeatureIcon({ icon }: { icon: string }) {
  const icons: Record<string, string> = {
    MessageSquare: '💬',
    Bot: '🤖',
    Smartphone: '📱',
    Send: '✈️',
    UtensilsCrossed: '🍽️',
    ShoppingBag: '🛍️',
    Calendar: '📅',
    Users: '👥',
    TrendingUp: '📈',
    BarChart2: '📊',
    LineChart: '📉',
    Mail: '📧',
    MessageCircle: '💌',
    Headphones: '🎧',
  }
  return <span>{icons[icon] || '⚙️'}</span>
}
