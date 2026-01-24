import { useState, useEffect, useMemo } from 'react'
import type { MissionDetail as MissionDetailType, MissionStatus, StepRun } from '@haflow/shared'
import { Check, ChevronDown, ChevronUp, ArrowRight, Play } from 'lucide-react'
import * as Diff from 'diff'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { StepHistoryModal } from './StepHistoryModal'

interface MissionDetailProps {
  mission: MissionDetailType
  onSaveArtifact: (filename: string, content: string) => void
  onContinue: () => void
  onMarkCompleted: () => void
}

const statusConfig: Record<MissionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  ready: { label: 'Ready', variant: 'info' },
  waiting_human: { label: 'Waiting for Human Review', variant: 'warning' },
  running_code_agent: { label: 'Running Agent', variant: 'success' },
  running_root_llm: { label: 'Running LLM', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  completed: { label: 'Completed', variant: 'outline' },
}

function WorkflowTimeline({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: MissionDetailType['workflow']['steps']
  currentStep: number
  onStepClick?: (stepIndex: number) => void
}) {
  return (
    <div data-testid="workflow-timeline" className="flex items-center gap-1 py-4 px-4 md:px-6 overflow-x-auto">
      {steps.map((step, i: number) => {
        const isCompleted = i < currentStep
        const isCurrent = i === currentStep
        const isClickable = isCompleted && onStepClick

        return (
          <div key={step.step_id} data-testid={`workflow-step-${i}`} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                data-testid={`workflow-step-circle-${i}`}
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isCurrent
                    ? 'bg-background border-primary text-primary'
                    : 'bg-background border-muted text-muted-foreground',
                  isClickable && 'cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-2'
                )}
                aria-label={isClickable ? `View step ${i + 1}: ${step.name}` : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              <span
                className={cn(
                  'mt-1 text-xs whitespace-nowrap',
                  isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {step.name}
              </span>
            </div>
            {/* Connector Line */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'w-12 h-0.5 mx-1',
                  isCompleted ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ActivityHistory({ runs }: { runs: StepRun[] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-t">
      <button
        data-testid="activity-history-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 md:px-6 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-medium">Activity History</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="px-4 md:px-6 pb-4 space-y-2">
          {runs.map((run) => (
            <div key={`${run.step_id}-${run.run_id}`} className="text-sm text-muted-foreground">
              <span className="font-medium">Step {run.step_id}:</span>{' '}
              {run.exit_code === 0 ? (
                <span className="text-green-600">
                  Cleanup (Agent Run #{run.run_id.split('-')[1]}) - Finished Successfully
                </span>
              ) : run.exit_code !== undefined ? (
                <span className="text-destructive">Failed with exit code {run.exit_code}</span>
              ) : (
                <span className="text-amber-600">Running...</span>
              )}
              {run.finished_at && (
                <span className="text-muted-foreground ml-2">
                  - {new Date(run.finished_at).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface DiffViewerProps {
  original: string
  modified: string
}

function DiffViewer({ original, modified }: DiffViewerProps) {
  const diffResult = useMemo(() => {
    return Diff.diffLines(original, modified)
  }, [original, modified])

  const hasChanges = diffResult.some(part => part.added || part.removed)

  if (!hasChanges) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No changes made
      </div>
    )
  }

  return (
    <div className="font-mono text-sm overflow-auto h-full">
      {diffResult.map((part, index) => {
        const lines = part.value.split('\n')
        // Remove last empty line from split if the value ends with newline
        if (lines[lines.length - 1] === '') {
          lines.pop()
        }

        return lines.map((line, lineIndex) => {
          const key = `${index}-${lineIndex}`

          if (part.added) {
            return (
              <div
                key={key}
                className="bg-green-500/20 border-l-4 border-green-500 px-3 py-0.5"
              >
                <span className="text-green-600 select-none mr-2">+</span>
                <span className="text-green-700 dark:text-green-300">{line || ' '}</span>
              </div>
            )
          }

          if (part.removed) {
            return (
              <div
                key={key}
                className="bg-red-500/20 border-l-4 border-red-500 px-3 py-0.5"
              >
                <span className="text-red-600 select-none mr-2">-</span>
                <span className="text-red-700 dark:text-red-300">{line || ' '}</span>
              </div>
            )
          }

          return (
            <div
              key={key}
              className="px-3 py-0.5 border-l-4 border-transparent"
            >
              <span className="text-muted-foreground select-none mr-2">&nbsp;</span>
              <span>{line || ' '}</span>
            </div>
          )
        })
      })}
    </div>
  )
}

export function MissionDetail({ mission, onSaveArtifact, onContinue, onMarkCompleted }: MissionDetailProps) {
  const [viewMode, setViewMode] = useState<'editor' | 'diff' | 'preview'>('editor')
  const [editorContent, setEditorContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedHistoryStepIndex, setSelectedHistoryStepIndex] = useState<number | null>(null)

  const handleHistoryStepClick = (stepIndex: number) => {
    setSelectedHistoryStepIndex(stepIndex)
  }

  const handleCloseHistoryModal = () => {
    setSelectedHistoryStepIndex(null)
  }

  const selectedHistoryStep = selectedHistoryStepIndex !== null
    ? mission.workflow.steps[selectedHistoryStepIndex]
    : null

  const currentStep = mission.workflow.steps[mission.current_step]
  const artifactName = currentStep?.type === 'human-gate'
    ? currentStep.reviewArtifact
    : currentStep?.outputArtifact
  const artifactContent = artifactName ? mission.artifacts[artifactName] : null

  // Show human-gate editor for waiting_human, OR for ready/draft when current step is human-gate
  const shouldShowHumanGateEditor =
    artifactName && (
      mission.status === 'waiting_human' ||
      ((mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'human-gate')
    )

  useEffect(() => {
    if (artifactContent && !hasChanges) {
      setEditorContent(artifactContent)
      setOriginalContent(artifactContent)
    }
  }, [artifactContent, hasChanges])

  const handleSave = () => {
    if (artifactName) {
      onSaveArtifact(artifactName, editorContent)
      setHasChanges(false)
    }
  }

  const statusInfo = statusConfig[mission.status]

  return (
    <div className="flex-1 flex flex-col h-screen bg-muted/30 pt-14 md:pt-0">
      {/* Header */}
      <div data-testid="mission-detail-header" className="bg-background border-b px-4 md:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <h2 data-testid="mission-title" className="text-lg md:text-xl font-semibold truncate">
            Mission: {mission.title}
          </h2>
          <Badge data-testid="mission-status-badge" variant={statusInfo.variant} className="w-fit">
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      {/* Workflow Timeline */}
      <div className="bg-background border-b">
        <WorkflowTimeline
          steps={mission.workflow.steps}
          currentStep={mission.current_step}
          onStepClick={handleHistoryStepClick}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {mission.status === 'running_code_agent' || mission.status === 'running_root_llm' ? (
          // Log viewer for running agent
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Agent running...</CardTitle>
              </CardHeader>
              <CardContent>
                <pre data-testid="agent-log-viewer" className="font-mono text-sm bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-auto">
                  {mission.current_log_tail || 'Waiting for output...'}
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : shouldShowHumanGateEditor ? (
          // Editor for human gate
          <div className="flex-1 flex flex-col items-start p-4 md:p-6 overflow-hidden">
            <Card className="flex-1 flex flex-col overflow-hidden w-full max-w-6xl">
              {/* Editor Header */}
              <div className="flex flex-col gap-3 px-3 md:px-4 py-3 border-b">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <span className="text-sm font-medium">
                    Current Step: {currentStep?.name}
                  </span>
                  <div className="flex items-center gap-1 md:gap-2 text-sm text-muted-foreground">
                    <span className="hidden md:inline">View:</span>
                    <Button
                      data-testid="view-mode-editor"
                      variant={viewMode === 'editor' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('editor')}
                    >
                      Editor
                    </Button>
                    <span className="hidden md:inline">/</span>
                    <Button
                      data-testid="view-mode-diff"
                      variant={viewMode === 'diff' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('diff')}
                    >
                      Diff
                    </Button>
                    <span className="hidden md:inline">/</span>
                    <Button
                      data-testid="view-mode-preview"
                      variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('preview')}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <Button
                    data-testid="save-draft-button"
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className="flex-1 md:flex-none"
                  >
                    Save Draft
                  </Button>
                  <Button data-testid="continue-button" size="sm" onClick={onContinue} className="flex-1 md:flex-none">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-auto p-4">
                {viewMode === 'editor' ? (
                  <Textarea
                    data-testid="artifact-editor"
                    value={editorContent}
                    onChange={(e) => {
                      setEditorContent(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full h-full min-h-75 font-mono text-sm resize-none"
                  />
                ) : viewMode === 'diff' ? (
                  <DiffViewer original={originalContent} modified={editorContent} />
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {editorContent}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

            </Card>
          </div>
        ) : mission.status === 'failed' ? (
          // Error display
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Mission Failed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre data-testid="error-message" className="font-mono text-sm bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-auto">
                  {mission.last_error}
                </pre>
                {mission.current_log_tail && (
                  <pre className="font-mono text-sm bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-auto">
                    {mission.current_log_tail}
                  </pre>
                )}
                <Button data-testid="mark-completed-button" variant="outline" onClick={onMarkCompleted}>
                  Mark as Completed
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (mission.status === 'ready' || mission.status === 'draft') && currentStep?.type === 'agent' ? (
          // Ready to start agent
          <div className="flex-1 p-4 md:p-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">Ready to run: {currentStep.name}</p>
                <Button data-testid="start-agent-button" onClick={onContinue}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Agent
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Completed or other state
          <div className="flex-1 p-4 md:p-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  Mission status: <span className="font-medium text-foreground">{mission.status}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Activity History */}
        <div className="bg-background">
          <ActivityHistory runs={mission.runs} />
        </div>
      </div>

      {/* Step History Modal */}
      <StepHistoryModal
        isOpen={selectedHistoryStepIndex !== null}
        onClose={handleCloseHistoryModal}
        step={selectedHistoryStep}
        stepIndex={selectedHistoryStepIndex ?? 0}
        artifacts={mission.artifacts}
        runs={mission.runs}
      />
    </div>
  )
}
