import clsx from 'clsx'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'amber'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-gray-100 text-gray-800': variant === 'default',
          'bg-green-100 text-green-800': variant === 'success',
          'bg-yellow-100 text-yellow-800': variant === 'warning',
          'bg-red-100 text-red-800': variant === 'danger',
          'bg-blue-100 text-blue-800': variant === 'info',
          'bg-purple-100 text-purple-800': variant === 'purple',
          'bg-amber-100 text-amber-800': variant === 'amber',
        },
        className
      )}
    >
      {children}
    </span>
  )
}

export function PlanBadge({ plan }: { plan: string }) {
  const variants: Record<string, 'info' | 'purple' | 'amber'> = {
    BASICO: 'info',
    PROFESIONAL: 'purple',
    ENTERPRISE: 'amber',
  }
  const labels: Record<string, string> = {
    BASICO: 'Básico',
    PROFESIONAL: 'Profesional',
    ENTERPRISE: 'Enterprise',
  }
  return <Badge variant={variants[plan] || 'default'}>{labels[plan] || plan}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'danger' | 'warning'> = {
    ACTIVO: 'success',
    SUSPENDIDO: 'danger',
    PRUEBA: 'warning',
  }
  const labels: Record<string, string> = {
    ACTIVO: 'Activo',
    SUSPENDIDO: 'Suspendido',
    PRUEBA: 'Prueba',
  }
  return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>
}
