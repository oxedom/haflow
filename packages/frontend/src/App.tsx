import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { MissionDetail as MissionDetailView } from '@/components/MissionDetail'
import { NewMissionModal } from '@/components/NewMissionModal'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'

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
      ralphMode,
      ralphMaxIterations,
    }: {
      title: string
      type: 'feature' | 'fix' | 'bugfix'
      rawInput: string
      ralphMode?: boolean
      ralphMaxIterations?: number
    }) => {
      return api.createMission(title, type, rawInput, ralphMode, ralphMaxIterations)
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
    ralphMode?: boolean,
    ralphMaxIterations?: number
  ) => {
    await createMissionMutation.mutateAsync({ title, type, rawInput, ralphMode, ralphMaxIterations })
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
        <h1 className="text-lg font-semibold">hafloo</h1>
      </div>

      <Sidebar
        missions={missions}
        selectedMissionId={selectedMissionId}
        onSelectMission={handleSelectMission}
        onNewMission={handleNewMission}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {selectedMission ? (
        <MissionDetailView
          mission={selectedMission}
          onSaveArtifact={handleSaveArtifact}
          onContinue={handleContinue}
          onMarkCompleted={handleMarkCompleted}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center pt-14 md:pt-0">
          <div className="text-center text-muted-foreground px-4">
            <h2 className="text-xl font-semibold mb-2">Welcome to haflow</h2>
            <p>Select a mission from the sidebar or create a new one.</p>
          </div>
        </div>
      )}

      <NewMissionModal
        isOpen={isNewMissionModalOpen}
        onClose={() => setIsNewMissionModalOpen(false)}
        onSubmit={handleCreateMission}
      />
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
