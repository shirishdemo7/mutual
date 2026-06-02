import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { InviteMemberButton } from '@/components/members/InviteMemberButton'
import { DeleteMemberButton } from '@/components/members/DeleteMemberButton'
import { EditMemberButton } from '@/components/members/EditMemberButton'
import { formatCurrency, formatNumber, formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Profile, UnitLedger, FundStats } from '@/types'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const [membersRes, ledgersRes, statsRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('unit_ledger').select('*'),
    supabase.from('fund_stats').select('*').eq('id', 1).single(),
  ])

  const members = (membersRes.data ?? []) as Profile[]
  const ledgers = (ledgersRes.data ?? []) as UnitLedger[]
  const stats = statsRes.data as FundStats | null

  const nav = stats?.nav ?? 100
  const totalUnits = stats?.total_units ?? 0

  const ledgerMap = new Map(ledgers.map(l => [l.member_id, l]))

  const memberRows = members
    .filter(m => m.role === 'member')
    .map(m => {
      const ledger = ledgerMap.get(m.id)
      const units = ledger?.units ?? 0
      const invested = ledger?.total_invested ?? 0
      const withdrawn = ledger?.total_withdrawn ?? 0
      const currentValue = units * nav
      const pnl = currentValue - invested
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
      const ownership = totalUnits > 0 ? (units / totalUnits) * 100 : 0
      return { member: m, units, invested, withdrawn, currentValue, pnl, pnlPct, ownership }
    })
    .sort((a, b) => b.units - a.units)

  return (
    <div>
      <TopBar
        title="Members"
        subtitle={`${memberRows.length} investors in the pool`}
        actions={<InviteMemberButton />}
      />

      <div className="p-6 space-y-6">
        {/* Fund summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Total Members</p>
            <p className="font-financial text-2xl font-semibold text-text-primary">{memberRows.length}</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Current NAV</p>
            <p className="font-financial text-2xl font-semibold text-text-primary">{formatNumber(nav, 4)}</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Total Units</p>
            <p className="font-financial text-2xl font-semibold text-text-primary">{formatNumber(totalUnits, 4)}</p>
          </div>
        </div>

        <Card>
          <CardContent className="px-0 py-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border">
                    {['Member', 'Status', 'Units', 'Invested', 'Withdrawn', 'Current Value', 'P&L', 'Ownership', 'Joined', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {memberRows.map(({ member, units, invested, withdrawn, currentValue, pnl, pnlPct, ownership }) => (
                    <tr key={member.id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-semibold text-text-primary">{member.full_name}</p>
                          <p className="text-xs text-text-muted">{member.email}</p>
                          {member.phone && <p className="text-xs text-text-muted">{member.phone}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={member.is_active ? 'success' : 'muted'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-financial text-text-primary">{formatNumber(units, 4)}</td>
                      <td className="px-5 py-3.5 font-financial text-text-primary">{formatCurrency(invested)}</td>
                      <td className="px-5 py-3.5 font-financial text-text-secondary">{formatCurrency(withdrawn)}</td>
                      <td className="px-5 py-3.5 font-financial font-semibold text-text-primary">{formatCurrency(currentValue)}</td>
                      <td className={cn('px-5 py-3.5 font-financial font-medium', pnl >= 0 ? 'text-profit' : 'text-loss')}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                        <span className="ml-1 text-xs opacity-70">
                          ({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-surface-border rounded-full h-1.5">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(ownership, 100)}%` }}
                            />
                          </div>
                          <span className="font-financial text-xs text-text-secondary">{ownership.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-text-muted text-xs whitespace-nowrap">
                        {formatDateShort(member.joined_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <EditMemberButton member={member} />
                          <DeleteMemberButton memberId={member.id} memberName={member.full_name} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {memberRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-10 text-center text-text-muted">
                        No members yet. Invite your first investor.
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
