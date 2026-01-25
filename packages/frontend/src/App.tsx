import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Menu, Headphones, Trash2 } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { MissionDetail as MissionDetailView } from '@/components/MissionDetail'
import { NewMissionModal } from '@/components/NewMissionModal'
import { ChatVoice } from '@/components/ChatVoice'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Create QueryClient with polling defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 2000, // Poll every 2 seconds
      staleTime: 1000,
    },
  },
})

function AppContent() {
  const queryClient = useQueryClient()
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null)
  const [isNewMissionModalOpen, setIsNewMissionModalOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showVoiceChat, setShowVoiceChat] = useState(false)
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false)

  // Query: Fetch missions list with polling
  const { data: missions = [], isLoading: isLoadingMissions } = useQuery({
    queryKey: ['missions'],
    queryFn: api.listMissions,
  })

  // Query: Fetch selected mission details with polling
  // Use faster polling (500ms) when mission is running
  const { data: selectedMission } = useQuery({
    queryKey: ['mission', selectedMissionId],
    queryFn: () => api.getMission(selectedMissionId!),
    enabled: !!selectedMissionId,
    refetchInterval: (query) => {
      const mission = query.state.data
      if (mission?.status === 'running_code_agent' || mission?.status === 'running_root_llm') {
        return 500 // Faster polling when running
      }
      return 2000 // Normal polling
    },
  })

  // Mutation: Create mission
  const createMissionMutation = useMutation({
    mutationFn: async ({
      title,
      type,
      rawInput,
      workflowId,
    }: {
      title: string
      type: 'feature' | 'fix' | 'bugfix'
      rawInput: string
      workflowId: string
    }) => {
      return api.createMission(title, type, rawInput, workflowId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] })
    },
  })

  // Mutation: Save artifact
  const saveArtifactMutation = useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      if (!selectedMissionId) return
      return api.saveArtifact(selectedMissionId, filename, content)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission', selectedMissionId] })
    },
  })

  // Mutation: Continue mission
  const continueMissionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMissionId) return
      return api.continueMission(selectedMissionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] })
      queryClient.invalidateQueries({ queryKey: ['mission', selectedMissionId] })
    },
  })

  // Mutation: Mark completed
  const markCompletedMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMissionId) return
      return api.markCompleted(selectedMissionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] })
    },
  })

  // Mutation: Cleanup containers
  const cleanupContainersMutation = useMutation({
    mutationFn: api.cleanupContainers,
    onSuccess: (data) => {
      setIsCleanupDialogOpen(false)
      alert(data.message)
    },
    onError: (error) => {
      alert(`Failed to cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    },
  })

  // Handlers
  const handleSelectMission = (id: string) => {
    setSelectedMissionId(id)
    setIsSidebarOpen(false) // Close sidebar on mobile after selection
  }

  const handleNewMission = () => {
    setIsNewMissionModalOpen(true)
  }

  const handleCreateMission = async (
    title: string,
    type: 'feature' | 'fix' | 'bugfix',
    rawInput: string,
    workflowId: string
  ) => {
    const newMission = await createMissionMutation.mutateAsync({ title, type, rawInput, workflowId })
    setSelectedMissionId(newMission.mission_id)
  }

  const handleSaveArtifact = async (filename: string, content: string) => {
    await saveArtifactMutation.mutateAsync({ filename, content })
  }

  const handleContinue = async () => {
    await continueMissionMutation.mutateAsync()
  }

  const handleMarkCompleted = async () => {
    await markCompletedMutation.mutateAsync()
  }

  if (isLoadingMissions) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-background border-b md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex items-center gap-2">
          <img src="/favicon-32x32.png" alt="Haflow logo" className="h-6 w-6 rounded" />
          <h1 className="text-lg font-semibold tracking-tight">haflow</h1>
        </div>
        <Button
          variant={showVoiceChat ? 'default' : 'outline'}
          size="icon"
          onClick={() => setShowVoiceChat(!showVoiceChat)}
          title="Voice Chat"
          data-testid="voice-chat-button-mobile"
        >
          <Headphones className="h-4 w-4" />
        </Button>
      </div>

      <Sidebar
        missions={missions}
        selectedMissionId={selectedMissionId}
        onSelectMission={handleSelectMission}
        onNewMission={handleNewMission}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col pt-14 md:pt-0">
        {/* Desktop Header with Voice Chat toggle */}
        <div className="hidden md:flex items-center justify-end gap-2 px-4 py-2 border-b">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCleanupDialogOpen(true)}
            title="Cleanup Docker Containers"
            data-testid="cleanup-containers-button"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant={showVoiceChat ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowVoiceChat(!showVoiceChat)}
            title="Voice Chat"
            data-testid="voice-chat-button-desktop"
          >
            <Headphones className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0">
          {showVoiceChat ? (
            <ChatVoice
              title="Voice Chat"
              welcomeMessage="Hello! You can type or use voice input."
              onSubmitMessage={async (msg) => {
                // Echo for demo, or integrate with actual AI endpoint
                return `You said: ${msg}`;
              }}
            />
          ) : selectedMission ? (
            <MissionDetailView
              mission={selectedMission}
              onSaveArtifact={handleSaveArtifact}
              onContinue={handleContinue}
              onMarkCompleted={handleMarkCompleted}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground px-4">
                <h2 className="text-xl font-semibold mb-2">Welcome to haflow</h2>
                <p>Select a mission from the sidebar or create a new one.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewMissionModal
        isOpen={isNewMissionModalOpen}
        onClose={() => setIsNewMissionModalOpen(false)}
        onSubmit={handleCreateMission}
      />

      {/* Cleanup Containers Confirm Dialog */}
      <Dialog open={isCleanupDialogOpen} onOpenChange={setIsCleanupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cleanup Docker Containers</DialogTitle>
            <DialogDescription>
              This will remove all Docker containers with names starting with "haflow-claude".
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCleanupDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => cleanupContainersMutation.mutate()}
              disabled={cleanupContainersMutation.isPending}
            >
              {cleanupContainersMutation.isPending ? 'Cleaning...' : 'Cleanup Containers'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
