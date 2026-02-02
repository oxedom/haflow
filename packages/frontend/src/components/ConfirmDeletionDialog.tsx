import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ConfirmDeletionDialogProps {
  isOpen: boolean
  title?: string
  description?: string
  itemCount: number
  reason?: string
  onReason?: (reason: string) => void
  onConfirm: () => Promise<void>
  onCancel: () => void
  isPending?: boolean
  error?: string
  showReasonInput?: boolean
}

export function ConfirmDeletionDialog({
  isOpen,
  title = 'Delete Mission',
  description = 'Are you sure you want to delete this mission?',
  itemCount,
  reason,
  onReason,
  onConfirm,
  onCancel,
  isPending = false,
  error,
  showReasonInput = false,
}: ConfirmDeletionDialogProps) {
  const [understood, setUnderstood] = useState(false)
  const [localReason, setLocalReason] = useState(reason || '')

  const handleConfirm = async () => {
    if (onReason) {
      onReason(localReason)
    }
    await onConfirm()
  }

  const isDeleteDisabled = isPending || !understood

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
            {itemCount > 1 && (
              <div className="mt-2 font-medium text-foreground">
                You are about to delete {itemCount} mission{itemCount !== 1 ? 's' : ''}.
              </div>
            )}
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
              This action cannot be undone.
            </div>
          </DialogDescription>
        </DialogHeader>

        {showReasonInput && (
          <div className="space-y-3">
            <Label htmlFor="delete-reason">Reason for deletion (optional)</Label>
            <Textarea
              id="delete-reason"
              placeholder="e.g., Testing completed, no longer needed, etc."
              value={localReason}
              onChange={(e) => setLocalReason(e.target.value)}
              disabled={isPending}
              className="resize-none"
              rows={3}
            />
          </div>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="understand"
            checked={understood}
            onCheckedChange={(checked) => setUnderstood(checked as boolean)}
            disabled={isPending}
          />
          <Label htmlFor="understand" className="text-sm cursor-pointer">
            I understand this action is permanent and cannot be undone
          </Label>
        </div>

        {error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleteDisabled}
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
