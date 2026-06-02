'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { deleteTransaction } from '@/app/actions/fund'

export function DeleteTransactionButton({ txId }: { txId: string }) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setLoading(true)
    await deleteTransaction(txId)
    setLoading(false)
    setConfirm(false)
  }

  return (
    <Button
      size="sm"
      variant="danger"
      onClick={handleDelete}
      loading={loading}
      title={confirm ? 'Click again to confirm' : 'Delete transaction'}
    >
      <Trash2 className="w-3 h-3" />
      {confirm ? 'Confirm?' : ''}
    </Button>
  )
}
