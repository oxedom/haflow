import { useState, useEffect, useCallback } from 'react'
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
import { generateMissionTitle, validateMissionTitle, sanitizeMissionTitle } from '@/lib/mission-title-generator'

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
  const [titleError, setTitleError] = useState<string | undefined>()
  const [type, setType] = useState<'feature' | 'fix' | 'bugfix'>('feature')
  const [rawInput, setRawInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [workflowId, setWorkflowId] = useState<string>('')

  const regenerateTitle = useCallback(() => {
    setTitle(generateMissionTitle())
    setTitleError(undefined)
  }, [])

  const handleTitleChange = useCallback((value: string) => {
    // Auto-sanitize as user types
    const sanitized = sanitizeMissionTitle(value)
    setTitle(sanitized)
    
    // Validate and show error if any
    const validation = validateMissionTitle(sanitized)
    setTitleError(validation.error)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Generate a random title when modal opens
      if (!title) {
        regenerateTitle()
      }
      
      api.getWorkflows().then((wfs) => {
        setWorkflows(wfs)
        // Only set default on first load
        setWorkflowId((prev) => prev || (wfs.length > 0 ? wfs[0].workflow_id : ''))
      })
    }
  }, [isOpen, title, regenerateTitle])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !rawInput.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit(title, type, rawInput, workflowId)
      setTitle('')
      setTitleError(undefined)
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
      <DialogContent data-testid="new-mission-modal" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Mission</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title">Title</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={regenerateTitle}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  🎲 Regenerate
                </Button>
              </div>
              <Input
                id="title"
                data-testid="mission-title-input"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="fox-swift"
                className={titleError ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {titleError && (
                <p className="text-xs text-red-500">{titleError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Format: animal-mood (no spaces, branch-safe)
              </p>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'feature' | 'fix' | 'bugfix')}>
                <SelectTrigger data-testid="mission-type-select">
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
                data-testid="mission-raw-input"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Describe the feature/fix in detail, or use the mic button to speak..."
                rows={8}
                className="font-mono text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="cancel-button">
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="create-mission-button"
              disabled={!title.trim() || !rawInput.trim() || isSubmitting || !!titleError}
            >
              {isSubmitting ? 'Creating...' : 'Create Mission'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
