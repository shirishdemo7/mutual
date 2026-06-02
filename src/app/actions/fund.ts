'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') throw new Error('Forbidden')
  return user
}

export async function recordDeposit(formData: FormData) {
  const supabase = await createClient()

  try {
    const adminUser = await requireAdmin(supabase)

    const memberId = formData.get('member_id') as string
    const amount = parseFloat(formData.get('amount') as string)
    const notes = formData.get('notes') as string

    if (!memberId || isNaN(amount) || amount <= 0) {
      return { error: 'Invalid input' }
    }

    // Get current fund stats
    const { data: stats } = await supabase
      .from('fund_stats')
      .select('*')
      .eq('id', 1)
      .single()

    if (!stats) return { error: 'Fund stats not found' }

    const currentNav = stats.nav || 100
    const unitsToIssue = amount / currentNav

    // Update unit_ledger for member
    const { data: ledger } = await supabase
      .from('unit_ledger')
      .select('*')
      .eq('member_id', memberId)
      .single()

    if (ledger) {
      const totalUnits = ledger.units + unitsToIssue
      const totalInvested = ledger.total_invested + amount
      const avgNav = totalInvested / totalUnits

      await supabase.from('unit_ledger').update({
        units: totalUnits,
        total_invested: totalInvested,
        avg_nav_at_purchase: avgNav,
      }).eq('member_id', memberId)
    } else {
      await supabase.from('unit_ledger').insert({
        member_id: memberId,
        units: unitsToIssue,
        total_invested: amount,
        avg_nav_at_purchase: currentNav,
      })
    }

    // Update fund stats
    const newTotalUnits = stats.total_units + unitsToIssue
    const newTotalValue = stats.total_fund_value + amount
    const newCashBalance = stats.cash_balance + amount

    await supabase.from('fund_stats').update({
      total_units: newTotalUnits,
      total_fund_value: newTotalValue,
      cash_balance: newCashBalance,
    }).eq('id', 1)

    // Log deposit transaction
    await supabase.from('transactions').insert({
      transaction_type: 'deposit',
      member_id: memberId,
      amount,
      units: unitsToIssue,
      nav_at_transaction: currentNav,
      notes,
      performed_by: adminUser.id,
    })

    // Log unit issuance
    await supabase.from('transactions').insert({
      transaction_type: 'unit_issue',
      member_id: memberId,
      amount,
      units: unitsToIssue,
      nav_at_transaction: currentNav,
      notes: `Issued ${unitsToIssue.toFixed(4)} units @ NAV ${currentNav.toFixed(4)}`,
      performed_by: adminUser.id,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/members')
    return { success: true }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function recordWithdrawal(formData: FormData) {
  const supabase = await createClient()

  try {
    const adminUser = await requireAdmin(supabase)

    const memberId = formData.get('member_id') as string
    const unitsToRedeem = parseFloat(formData.get('units') as string)
    const notes = formData.get('notes') as string

    if (!memberId || isNaN(unitsToRedeem) || unitsToRedeem <= 0) {
      return { error: 'Invalid input' }
    }

    const { data: stats } = await supabase
      .from('fund_stats').select('*').eq('id', 1).single()

    if (!stats) return { error: 'Fund stats not found' }

    const { data: ledger } = await supabase
      .from('unit_ledger').select('*').eq('member_id', memberId).single()

    if (!ledger) return { error: 'Member has no units' }
    if (ledger.units < unitsToRedeem) return { error: 'Insufficient units' }

    const currentNav = stats.nav
    const withdrawalAmount = unitsToRedeem * currentNav
    const remainingUnits = ledger.units - unitsToRedeem

    await supabase.from('unit_ledger').update({
      units: remainingUnits,
      total_withdrawn: ledger.total_withdrawn + withdrawalAmount,
    }).eq('member_id', memberId)

    const newTotalUnits = stats.total_units - unitsToRedeem
    const newTotalValue = stats.total_fund_value - withdrawalAmount
    const newCashBalance = stats.cash_balance - withdrawalAmount

    await supabase.from('fund_stats').update({
      total_units: Math.max(0, newTotalUnits),
      total_fund_value: Math.max(0, newTotalValue),
      cash_balance: Math.max(0, newCashBalance),
    }).eq('id', 1)

    await supabase.from('transactions').insert([
      {
        transaction_type: 'withdrawal',
        member_id: memberId,
        amount: withdrawalAmount,
        units: unitsToRedeem,
        nav_at_transaction: currentNav,
        notes,
        performed_by: adminUser.id,
      },
      {
        transaction_type: 'unit_redemption',
        member_id: memberId,
        amount: withdrawalAmount,
        units: unitsToRedeem,
        nav_at_transaction: currentNav,
        notes: `Redeemed ${unitsToRedeem.toFixed(4)} units @ NAV ${currentNav.toFixed(4)}`,
        performed_by: adminUser.id,
      },
    ])

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/members')
    return { success: true }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function deleteTransaction(txId: string) {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
    const { error } = await supabase.from('transactions').delete().eq('id', txId)
    if (error) return { error: error.message }
    revalidatePath('/transactions')
    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function deleteAllTransactions() {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
    await supabase.from('transactions').delete().gte('created_at', '2000-01-01')
    revalidatePath('/transactions')
    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function updateFundValue(formData: FormData) {
  const supabase = await createClient()

  try {
    const adminUser = await requireAdmin(supabase)

    const newValue = parseFloat(formData.get('total_fund_value') as string)
    const notes = formData.get('notes') as string

    if (isNaN(newValue) || newValue < 0) return { error: 'Invalid value' }

    const { data: stats } = await supabase
      .from('fund_stats').select('*').eq('id', 1).single()

    if (!stats) return { error: 'Fund stats not found' }

    await supabase.from('fund_stats').update({
      total_fund_value: newValue,
    }).eq('id', 1)

    const newNav = stats.total_units > 0 ? newValue / stats.total_units : 100

    await supabase.from('transactions').insert({
      transaction_type: 'nav_update',
      amount: newValue,
      nav_at_transaction: newNav,
      notes: notes || `Fund value updated to ${newValue}`,
      performed_by: adminUser.id,
    })

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    return { success: true }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
