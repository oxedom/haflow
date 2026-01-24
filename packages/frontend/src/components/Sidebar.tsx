import type { MissionListItem, MissionStatus } from '@haflow/shared'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SidebarProps {
  missions: MissionListItem[]
  selectedMissionId: string | null
  onSelectMission: (id: string) => void
  onNewMission: () => void
  isOpen: boolean
  onClose: () => void
}

const statusConfig: Record<MissionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  ready: { label: 'Ready', variant: 'info' },
  waiting_human: { label: 'Waiting', variant: 'warning' },
  running_code_agent: { label: 'Running', variant: 'success' },
  running_root_llm: { label: 'Running', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
  completed: { label: 'Done', variant: 'outline' },
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StatusBadge({ status }: { status: MissionStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
      {config.label}
    </Badge>
  )
}

export function Sidebar({ missions, selectedMissionId, onSelectMission, onNewMission, isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ease-in-out md:relative md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <h1 className="text-lg font-semibold text-sidebar-foreground">HAFLOW</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* New Mission Button */}
        <div className="p-3">
          <Button
            onClick={onNewMission}
            variant="outline"
            className="w-full justify-start"
            data-testid="new-mission-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Mission
          </Button>
        </div>

        <Separator />

        {/* Mission List */}
        <ScrollArea className="flex-1">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent Missions
          </div>
          <div className="space-y-1 px-2 pb-4">
            {missions.map((mission) => (
              <button
                key={mission.mission_id}
                onClick={() => onSelectMission(mission.mission_id)}
                className={cn(
                  'w-full text-left p-3 rounded-md transition-colors',
                  selectedMissionId === mission.mission_id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate pr-2">
                    {mission.title}
                  </span>
                  <StatusBadge status={mission.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground capitalize">
                    {mission.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(mission.updated_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}
