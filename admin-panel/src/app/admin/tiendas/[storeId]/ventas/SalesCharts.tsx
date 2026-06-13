'use client'

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'

const METHOD_LABEL: Record<string, string> = {
  CARD: 'Tarjeta', SPEI: 'SPEI', CASH_OXXO: 'OXXO', CASH_IN_STORE: 'Efectivo en tienda',
}
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const fmtMxn = (v: number) =>
  '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtMxnFull = (v: number) =>
  '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export function SalesCharts({
  revenueByDay,
  paymentsByMethod,
  topProducts,
}: {
  revenueByDay: { date: string; revenue: number; orders: number; layaways: number }[]
  paymentsByMethod: { method: string; amount: number }[]
  topProducts: { name: string; units: number; revenue: number }[]
}) {
  const totalByMethod = paymentsByMethod.reduce((a, b) => a + b.amount, 0) || 1

  return (
    <div className="space-y-6">
      {/* Ingresos por día */}
      <section className="bg-white rounded-lg border p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Ingresos por día</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueByDay} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date" tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis tickFormatter={fmtMxn} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip
              labelFormatter={(d) => fmtDate(String(d))}
              formatter={(v: number, name) =>
                name === 'revenue' ? [fmtMxnFull(v), 'Ingresos'] : [v, name]
              }
            />
            <Line
              type="monotone" dataKey="revenue"
              stroke="#6366f1" strokeWidth={2}
              dot={{ r: 3 }} activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Métodos de pago */}
        <section className="bg-white rounded-lg border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Métodos de pago</h2>
          {paymentsByMethod.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">Sin pagos confirmados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={paymentsByMethod}
                  dataKey="amount"
                  nameKey="method"
                  innerRadius={50}
                  outerRadius={90}
                  label={(e) => `${Math.round((Number(e.amount) / totalByMethod) * 100)}%`}
                  labelLine={false}
                >
                  {paymentsByMethod.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name) =>
                    [fmtMxnFull(v), METHOD_LABEL[String(name)] ?? String(name)]
                  }
                />
                <Legend formatter={(v) => METHOD_LABEL[String(v)] ?? String(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Top productos */}
        <section className="bg-white rounded-lg border p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Top productos por unidades</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topProducts} layout="vertical"
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis
                  dataKey="name" type="category" width={120}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                />
                <Tooltip
                  formatter={(v: number, name, p) => {
                    if (name === 'units') return [v, 'Unidades']
                    return [fmtMxnFull(Number(p.payload?.revenue)), 'Ingresos']
                  }}
                />
                <Bar dataKey="units" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  )
}
