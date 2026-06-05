'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FeatureDef } from '@/lib/features'
import type { ClientFeature } from '@prisma/client'
import ToolConfigPanel from './ToolConfigPanel'

interface Props {
  clientId: string
  features: FeatureDef[]
  featureMap: Record<string, ClientFeature>
  configMap: Record<string, Record<string, string>>
}

const CONFIGURABLE_FEATURES = new Set([
  'chatbot_basico', 'chatbot_ia', 'whatsapp', 'telegram',
  'menu_digital', 'catalogo_digital', 'reservaciones',
  'crm_basico', 'crm_avanzado', 'analytics_basico', 'analytics_avanzado',
  'notificaciones_email', 'notificaciones_sms', 'soporte_prioritario',
  'generacion_imagenes',
])

export default function FeatureToggles({ clientId, features, featureMap, configMap }: Props) {
  const router = useRouter()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [localState, setLocalState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(features.map((f) => [f.key, featureMap[f.key]?.enabled ?? false]))
  )

  async function toggle(featureKey: string) {
    const newValue = !localState[featureKey]
    setLoadingKey(featureKey)
    setLocalState((prev) => ({ ...prev, [featureKey]: newValue }))

    try {
      const res = await fetch(`/api/admin/clientes/${clientId}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureKey, enabled: newValue }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.refresh()
    } catch {
      setLocalState((prev) => ({ ...prev, [featureKey]: !newValue }))
    } finally {
      setLoadingKey(null)
    }
  }

  function toggleConfig(featureKey: string) {
    setExpandedKey((prev) => (prev === featureKey ? null : featureKey))
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {features.map((feature) => {
        const enabled = localState[feature.key]
        const isLoading = loadingKey === feature.key
        const isExpanded = expandedKey === feature.key
        const isConfigurable = CONFIGURABLE_FEATURES.has(feature.key)
        const featureConfig = configMap[feature.key] ?? {}
        const hasConfig = Object.keys(featureConfig).some((k) => featureConfig[k])

        return (
          <div key={feature.key} className="flex flex-col">
            <div
              className={`border rounded-xl p-4 flex items-start gap-3 transition-all ${
                enabled
                  ? isExpanded
                    ? 'border-indigo-400 bg-indigo-50 rounded-b-none border-b-0'
                    : 'border-indigo-200 bg-indigo-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${
                enabled ? 'bg-indigo-100' : 'bg-gray-100'
              }`}>
                <FeatureIcon icon={feature.icon} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${enabled ? 'text-indigo-900' : 'text-gray-700'}`}>
                    {feature.name}
                  </p>
                  {hasConfig && enabled && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                      Configurado
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{feature.description}</p>

                {isConfigurable && (
                  <button
                    onClick={() => toggleConfig(feature.key)}
                    className={`mt-2 text-xs font-medium flex items-center gap-1 transition-colors ${
                      enabled
                        ? 'text-indigo-600 hover:text-indigo-800'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <span>{isExpanded ? '▲' : '▼'}</span>
                    <span>{isExpanded ? 'Cerrar configuración' : 'Configurar'}</span>
                  </button>
                )}
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

            {isExpanded && isConfigurable && (
              <ToolConfigPanel
                clientId={clientId}
                featureKey={feature.key}
                initialValues={featureConfig}
                onSaved={() => router.refresh()}
              />
            )}
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
    ImagePlus: '🎨',
  }
  return <span>{icons[icon] || '⚙️'}</span>
}
