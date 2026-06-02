import clsx from 'clsx'

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx('w-full text-sm', className)}>{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={clsx('px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider', className)}>
      {children}
    </th>
  )
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={clsx('hover:bg-gray-50 transition-colors', className)}>{children}</tr>
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={clsx('px-6 py-4', className)}>{children}</td>
}
