'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

const inviteMemberSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  password: z.string().min(8),
})

export async function inviteMember(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden' }

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    phone: formData.get('phone') || undefined,
    password: formData.get('password'),
  })

  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const adminClient = await createAdminClient()

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: 'member',
    },
  })

  if (createError) return { error: createError.message }

  // Upsert profile details (trigger may have already created the row)
  await adminClient.from('profiles').upsert({
    id: newUser.user.id,
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone ?? null,
    role: 'member',
    agreed_to_disclaimer: true,
  })

  // Create unit_ledger row for new member
  await adminClient.from('unit_ledger').upsert({
    member_id: newUser.user.id,
    units: 0,
    total_invested: 0,
    total_withdrawn: 0,
    avg_nav_at_purchase: 100,
  })

  revalidatePath('/members')
  return { success: true, userId: newUser.user.id }
}

export async function deleteMember(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden' }
  if (memberId === user.id) return { error: 'Cannot delete your own account' }

  const adminClient = await createAdminClient()

  await adminClient.from('transactions').delete().eq('member_id', memberId)
  await adminClient.from('unit_ledger').delete().eq('member_id', memberId)

  const { error } = await adminClient.auth.admin.deleteUser(memberId)
  if (error) return { error: error.message }

  revalidatePath('/members')
  revalidatePath('/admin')
  revalidatePath('/transactions')
  return { success: true }
}

export async function updateMember(memberId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden' }

  const { error } = await supabase.from('profiles').update({
    full_name: formData.get('full_name') as string,
    phone: formData.get('phone') as string || null,
    is_active: formData.get('is_active') === 'true',
  }).eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/members')
  return { success: true }
}
