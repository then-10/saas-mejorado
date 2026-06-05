export interface FeatureDef {
  key: string
  name: string
  description: string
  icon: string
  plans: string[]
}

export const FEATURES: Record<string, FeatureDef> = {
  chatbot_basico: {
    key: 'chatbot_basico',
    name: 'Chatbot Básico',
    description: 'Respuestas automáticas sin IA',
    icon: 'MessageSquare',
    plans: ['BASICO', 'PROFESIONAL', 'ENTERPRISE'],
  },
  chatbot_ia: {
    key: 'chatbot_ia',
    name: 'Chatbot con IA',
    description: 'Bot inteligente con Claude AI',
    icon: 'Bot',
    plans: ['PROFESIONAL', 'ENTERPRISE'],
  },
  whatsapp: {
    key: 'whatsapp',
    name: 'WhatsApp',
    description: 'Integración con WhatsApp Business',
    icon: 'Smartphone',
    plans: ['BASICO', 'PROFESIONAL', 'ENTERPRISE'],
  },
  telegram: {
    key: 'telegram',
    name: 'Telegram',
    description: 'Integración con Telegram',
    icon: 'Send',
    plans: ['PROFESIONAL', 'ENTERPRISE'],
  },
  menu_digital: {
    key: 'menu_digital',
    name: 'Menú Digital',
    description: 'Menú digital para restaurantes',
    icon: 'UtensilsCrossed',
    plans: ['BASICO', 'PROFESIONAL', 'ENTERPRISE'],
  },
  catalogo_digital: {
    key: 'catalogo_digital',
    name: 'Catálogo Digital',
    description: 'Catálogo de productos para tiendas',
    icon: 'ShoppingBag',
    plans: ['BASICO', 'PROFESIONAL', 'ENTERPRISE'],
  },
  reservaciones: {
    key: 'reservaciones',
    name: 'Reservaciones',
    description: 'Sistema de reservaciones en línea',
    icon: 'Calendar',
    plans: ['PROFESIONAL', 'ENTERPRISE'],
  },
  crm_basico: {
    key: 'crm_basico',
    name: 'CRM Básico',
    description: 'Gestión básica de clientes',
    icon: 'Users',
    plans: ['PROFESIONAL', 'ENTERPRISE'],
  },
  crm_avanzado: {
    key: 'crm_avanzado',
    name: 'CRM Avanzado',
    description: 'CRM completo con pipeline de ventas',
    icon: 'TrendingUp',
    plans: ['ENTERPRISE'],
  },
  analytics_basico: {
    key: 'analytics_basico',
    name: 'Analytics Básico',
    description: 'Reportes y métricas básicas',
    icon: 'BarChart2',
    plans: ['PROFESIONAL', 'ENTERPRISE'],
  },
  analytics_avanzado: {
    key: 'analytics_avanzado',
    name: 'Analytics Avanzado',
    description: 'Analytics avanzados con IA',
    icon: 'LineChart',
    plans: ['ENTERPRISE'],
  },
  notificaciones_email: {
    key: 'notificaciones_email',
    name: 'Notificaciones Email',
    description: 'Notificaciones automáticas por email',
    icon: 'Mail',
    plans: ['PROFESIONAL', 'ENTERPRISE'],
  },
  notificaciones_sms: {
    key: 'notificaciones_sms',
    name: 'Notificaciones SMS',
    description: 'Notificaciones automáticas por SMS',
    icon: 'MessageCircle',
    plans: ['ENTERPRISE'],
  },
  soporte_prioritario: {
    key: 'soporte_prioritario',
    name: 'Soporte Prioritario',
    description: 'Soporte 24/7 con respuesta prioritaria',
    icon: 'Headphones',
    plans: ['ENTERPRISE'],
  },
  generacion_imagenes: {
    key: 'generacion_imagenes',
    name: 'Generación de Imágenes IA',
    description: 'Crea imágenes con DALL-E 3 desde el bot',
    icon: 'ImagePlus',
    plans: ['PROFESIONAL', 'ENTERPRISE'],
  },
}

export const ALL_FEATURE_KEYS = Object.keys(FEATURES)

export function getFeaturesForPlan(plan: string): string[] {
  return ALL_FEATURE_KEYS.filter((key) => FEATURES[key].plans.includes(plan))
}

export const PLAN_PRICES: Record<string, number> = {
  BASICO: 29,
  PROFESIONAL: 79,
  ENTERPRISE: 199,
}

export const PLAN_LABELS: Record<string, string> = {
  BASICO: 'Básico',
  PROFESIONAL: 'Profesional',
  ENTERPRISE: 'Enterprise',
}

export const STATUS_LABELS: Record<string, string> = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  PRUEBA: 'Prueba',
}

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  RESTAURANTE: 'Restaurante',
  TIENDA_ROPA: 'Tienda de Ropa',
  CAFETERIA: 'Cafetería',
  OTRO: 'Otro',
}
