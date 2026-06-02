'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { deleteAllTransactions } from '@/app/actions/fund'

export function DeleteAllTransactionsButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true)
    setError('')
    const result = await deleteAllTransactions()
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="w-3.5 h-3.5" /> Delete All
      </Button>

      <Modal open={open} onClose={() => { setOpen(false); setError('') }} title="Delete All Transactions">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            This will permanently delete <span className="font-semibold text-loss">all transactions</span> from the audit log.
            Fund stats and member balances will not be affected.
          </p>
          {error && <p className="text-xs text-loss">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={loading} onClick={handleDelete}>
              Delete All Transactions
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
