import { useState, useEffect } from 'react'
import type { Workflow } from '@haflow/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VoiceRecorderButton } from './VoiceRecorderButton'
import { api } from '@/api/client'

interface NewMissionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    title: string,
    type: 'feature' | 'fix' | 'bugfix',
    rawInput: string,
    workflowId: string
  ) => void
}

export function NewMissionModal({ isOpen, onClose, onSubmit }: NewMissionModalProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'feature' | 'fix' | 'bugfix'>('feature')
  const [rawInput, setRawInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [workflowId, setWorkflowId] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      api.getWorkflows().then((wfs) => {
        setWorkflows(wfs)
        // Only set default on first load
        setWorkflowId((prev) => prev || (wfs.length > 0 ? wfs[0].workflow_id : ''))
      })
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !rawInput.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit(title, type, rawInput, workflowId)
      setTitle('')
      setType('feature')
      setRawInput('')
      setWorkflowId(workflows[0]?.workflow_id || '')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Mission</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="feat-user-auth"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'feature' | 'fix' | 'bugfix')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="fix">Fix</SelectItem>
                  <SelectItem value="bugfix">Bugfix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Workflow */}
            <div className="space-y-2">
              <Label htmlFor="workflow">Workflow</Label>
              <Select value={workflowId} onValueChange={setWorkflowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((wf) => (
                    <SelectItem key={wf.workflow_id} value={wf.workflow_id}>
                      {wf.name} ({wf.steps.length} steps)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Raw Input with Voice Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rawInput">Raw Input</Label>
                <VoiceRecorderButton
                  onTranscription={(text) => setRawInput(prev => prev ? prev + '\n\n' + text : text)}
                  size="sm"
                />
              </div>
              <Textarea
                id="rawInput"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Describe the feature/fix in detail, or use the mic button to speak..."
                rows={8}
                className="font-mono text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !rawInput.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Mission'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
