import ClientForm from '@/components/ClientForm'

export default function NuevoClientePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
        <p className="text-gray-500 text-sm mt-1">Agrega un nuevo negocio al panel</p>
      </div>
      <ClientForm />
    </div>
  )
}
