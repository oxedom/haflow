import type { WorkflowStep, StepRun } from '@haflow/shared'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface StepHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  step: WorkflowStep | null
  stepIndex: number
  artifacts: Record<string, string>
  runs: StepRun[]
}

export function StepHistoryModal({
  isOpen,
  onClose,
  step,
  stepIndex,
  artifacts,
  runs,
}: StepHistoryModalProps) {
  if (!step) return null

  // Find runs for this step
  const stepRuns = runs.filter((r) => r.step_id === step.step_id)
  const latestRun = stepRuns[stepRuns.length - 1]

  // Determine input and output artifact names
  const inputArtifactName = step.inputArtifact
  const outputArtifactName = step.type === 'human-gate'
    ? step.reviewArtifact
    : step.outputArtifact

  const inputContent = inputArtifactName ? artifacts[inputArtifactName] : null
  const outputContent = outputArtifactName ? artifacts[outputArtifactName] : null

  // Format duration if available
  const formatDuration = (run: StepRun | undefined) => {
    if (!run?.started_at || !run?.finished_at) return null
    const start = new Date(run.started_at)
    const end = new Date(run.finished_at)
    const diffMs = end.getTime() - start.getTime()
    const seconds = Math.floor(diffMs / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="step-history-modal"
        className="max-w-4xl max-h-[85vh] flex flex-col"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle data-testid="step-history-title">
              Step {stepIndex + 1}: {step.name}
            </DialogTitle>
            <Badge variant="outline" data-testid="step-type-badge">
              {step.type}
            </Badge>
          </div>
          {latestRun && (
            <DialogDescription data-testid="step-execution-info">
              Completed {new Date(latestRun.finished_at!).toLocaleString()}
              {formatDuration(latestRun) && ` (${formatDuration(latestRun)})`}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Artifact Display - Split on desktop, stacked on mobile */}
        <div
          data-testid="step-artifacts-container"
          className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 overflow-hidden"
        >
          {/* Input Artifact */}
          {inputArtifactName && (
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Input: {inputArtifactName}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[300px] md:max-h-[400px]">
                  <div className="p-4">
                    {inputContent ? (
                      inputArtifactName.endsWith('.json') ? (
                        <pre
                          data-testid="input-artifact-content"
                          className="font-mono text-sm whitespace-pre-wrap"
                        >
                          {inputContent}
                        </pre>
                      ) : (
                        <div
                          data-testid="input-artifact-content"
                          className="prose prose-sm dark:prose-invert max-w-none"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {inputContent}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p className="text-muted-foreground italic">
                        No input artifact
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Output Artifact */}
          {outputArtifactName && (
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-medium">
                  Output: {outputArtifactName}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[300px] md:max-h-[400px]">
                  <div className="p-4">
                    {outputContent ? (
                      outputArtifactName.endsWith('.json') ? (
                        <pre
                          data-testid="output-artifact-content"
                          className="font-mono text-sm whitespace-pre-wrap"
                        >
                          {outputContent}
                        </pre>
                      ) : (
                        <div
                          data-testid="output-artifact-content"
                          className="prose prose-sm dark:prose-invert max-w-none"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {outputContent}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p className="text-muted-foreground italic">
                        No output artifact
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Handle human-gate steps with only reviewArtifact */}
          {!inputArtifactName && !outputArtifactName && step.reviewArtifact && (
            <Card className="flex flex-col overflow-hidden md:col-span-2">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-medium">
                  Review: {step.reviewArtifact}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full max-h-[400px]">
                  <div className="p-4">
                    {artifacts[step.reviewArtifact] ? (
                      <div
                        data-testid="review-artifact-content"
                        className="prose prose-sm dark:prose-invert max-w-none"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {artifacts[step.reviewArtifact]}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">
                        No review artifact
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
