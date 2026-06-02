'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal, FormField, Input, Select } from '@/components/ui/Modal'
import { updateMember } from '@/app/actions/auth'
import type { Profile } from '@/types'

export function EditMemberButton({ member }: { member: Profile }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(fd: FormData) {
    setLoading(true)
    setError('')
    const result = await updateMember(member.id, fd)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setOpen(false) }, 1200)
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} title={`Edit ${member.full_name}`}>
        <Pencil className="w-3.5 h-3.5" /> Edit
      </Button>

      <Modal open={open} onClose={() => { setOpen(false); setError(''); setSuccess(false) }} title={`Edit ${member.full_name}`}>
        {success ? (
          <div className="py-6 text-center">
            <p className="text-profit font-medium">Updated successfully!</p>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <FormField label="Full Name" required>
              <Input name="full_name" defaultValue={member.full_name} required />
            </FormField>
            <FormField label="Phone">
              <Input name="phone" defaultValue={member.phone ?? ''} placeholder="+977 98XXXXXXXX" />
            </FormField>
            <FormField label="Status" required>
              <Select name="is_active" defaultValue={member.is_active ? 'true' : 'false'}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </FormField>
            <div className="pt-1 border-t border-surface-border">
              <p className="text-xs text-text-muted mb-1">Email (read-only)</p>
              <p className="text-sm text-text-secondary">{member.email}</p>
            </div>
            {error && <p className="text-xs text-loss">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={loading}>Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
