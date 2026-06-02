'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { deleteMember } from '@/app/actions/auth'

export function DeleteMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setLoading(true)
    setError('')
    const result = await deleteMember(memberId)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      setConfirm(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="danger"
        onClick={handleDelete}
        loading={loading}
        title={confirm ? `Click again to confirm deleting ${memberName}` : `Delete ${memberName}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        {confirm ? 'Confirm?' : 'Delete'}
      </Button>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  )
}
