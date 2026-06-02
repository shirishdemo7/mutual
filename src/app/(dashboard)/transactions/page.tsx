import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardContent } from '@/components/ui/Card'
import {
  formatCurrency, formatNumber, formatDate,
  TRANSACTION_LABELS, TRANSACTION_COLORS,
} from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownLeft, Activity } from 'lucide-react'
import type { Profile, Transaction } from '@/types'
import { DeleteTransactionButton } from '@/components/transactions/DeleteTransactionButton'
import { DeleteAllTransactionsButton } from '@/components/transactions/DeleteAllTransactionsButton'

export const dynamic = 'force-dynamic'

const TX_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  deposit: ArrowUpRight,
  unit_issue: ArrowUpRight,
  withdrawal: ArrowDownLeft,
  unit_redemption: ArrowDownLeft,
}

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, txRes] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('transactions')
      .select(`
        *,
        member:member_id ( full_name, email ),
        performer:performed_by ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const profile = profileRes.data as Profile
  const transactions = (txRes.data ?? []) as Transaction[]
  const isAdmin = profile.role === 'super_admin'

  // For members, filter to only their own transactions
  const visibleTx = isAdmin
    ? transactions
    : transactions.filter(tx => tx.member_id === user.id)

  return (
    <div>
      <TopBar
        title="Transactions"
        subtitle={`${visibleTx.length} records`}
        actions={isAdmin ? <DeleteAllTransactionsButton /> : undefined}
      />

      <div className="p-6">
        <Card>
          <CardContent className="px-0 py-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
                    {isAdmin && <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Member</th>}
                    <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Units</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">NAV</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Notes</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
                    {isAdmin && <th className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">By</th>}
                    {isAdmin && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {visibleTx.map(tx => {
                    const Icon = TX_ICONS[tx.transaction_type] ?? Activity
                    const isInflow = ['deposit', 'unit_issue'].includes(tx.transaction_type)
                    const isOutflow = ['withdrawal', 'unit_redemption'].includes(tx.transaction_type)
                    return (
                      <tr key={tx.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                              isInflow ? 'bg-profit/10' : isOutflow ? 'bg-loss/10' : 'bg-primary/10'
                            )}>
                              <Icon className={cn('w-3.5 h-3.5',
                                isInflow ? 'text-profit' : isOutflow ? 'text-loss' : 'text-primary'
                              )} />
                            </div>
                            <span className={cn('font-medium', TRANSACTION_COLORS[tx.transaction_type])}>
                              {TRANSACTION_LABELS[tx.transaction_type] ?? tx.transaction_type}
                            </span>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            <p className="text-text-primary">
                              {(tx.member as unknown as { full_name: string })?.full_name ?? '—'}
                            </p>
                          </td>
                        )}
                        <td className="px-5 py-3.5 font-financial">
                          {tx.amount != null ? (
                            <span className={cn('font-medium', isInflow ? 'text-profit' : isOutflow ? 'text-loss' : 'text-text-primary')}>
                              {isOutflow ? '−' : isInflow ? '+' : ''}{formatCurrency(tx.amount)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-financial text-text-secondary">
                          {tx.units != null ? formatNumber(tx.units, 4) : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-financial text-text-secondary">
                          {tx.nav_at_transaction != null ? formatNumber(tx.nav_at_transaction, 4) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-text-muted max-w-[180px] truncate" title={tx.notes ?? ''}>
                          {tx.asset_name && (
                            <span className="text-blue-400 mr-1">{tx.asset_name} · </span>
                          )}
                          {tx.notes ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-text-muted text-xs whitespace-nowrap">
                          {formatDate(tx.created_at)}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5 text-text-muted text-xs">
                            {(tx.performer as unknown as { full_name: string })?.full_name ?? '—'}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-3 py-3.5">
                            <DeleteTransactionButton txId={tx.id} />
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {visibleTx.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-text-muted">
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
