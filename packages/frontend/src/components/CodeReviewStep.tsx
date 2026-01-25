import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { RefreshCw, Play, Check, FileCode, Terminal } from 'lucide-react';
import { api } from '../api/client';
import type { MissionDetail, WorkflowStep } from '@haflow/shared';

interface CodeReviewStepProps {
  mission: MissionDetail;
  step: WorkflowStep;
  onContinue: () => void;
}

interface GitFile {
  path: string;
  status: string;
}

interface ExecutionState {
  id: string;
  status: 'running' | 'completed' | 'failed';
  output: string;
  command: string;
}

export function CodeReviewStep({ mission, step, onContinue }: CodeReviewStepProps) {
  const [gitFiles, setGitFiles] = useState<GitFile[]>([]);
  const [gitSummary, setGitSummary] = useState('');
  const [command, setCommand] = useState('');
  const [execution, setExecution] = useState<ExecutionState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const quickCommands = step.quickCommands || ['ls'];

  // Fetch git status
  const fetchGitStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const status = await api.getGitStatus(mission.mission_id);
      setGitFiles(status.files);
      setGitSummary(status.summary);
    } catch (err) {
      console.error('Failed to fetch git status:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [mission.mission_id]);

  // Initial fetch
  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

  // Poll execution status
  useEffect(() => {
    if (!execution || execution.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const result = await api.getExecution(mission.mission_id, execution.id);
        setExecution({
          id: result.id,
          status: result.status,
          output: result.output,
          command: execution.command,
        });
      } catch (err) {
        console.error('Failed to poll execution:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mission.mission_id, execution]);

  // Run command handler
  const handleRunCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    try {
      const result = await api.runCommand(mission.mission_id, cmd);
      setExecution({
        id: result.executionId,
        status: 'running',
        output: '',
        command: cmd,
      });
    } catch (err) {
      console.error('Failed to run command:', err);
    }
  };

  const statusColors: Record<string, string> = {
    M: 'text-yellow-500',  // Modified
    A: 'text-green-500',   // Added
    D: 'text-red-500',     // Deleted
    '?': 'text-blue-500',  // Untracked
  };

  return (
    <div className="space-y-4">
      {/* Git Status Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Git Status
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchGitStatus}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {gitFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes detected</p>
          ) : (
            <div className="space-y-1">
              {gitFiles.map(file => (
                <div
                  key={file.path}
                  className="px-2 py-1 text-sm font-mono flex items-center gap-2"
                >
                  <span className={statusColors[file.status] || 'text-foreground'}>
                    {file.status}
                  </span>
                  <span className="truncate">{file.path}</span>
                </div>
              ))}
            </div>
          )}
          {gitSummary && (
            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {gitSummary}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Command Runner */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Run Command
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Quick Commands */}
          <div className="flex flex-wrap gap-2">
            {quickCommands.map(cmd => (
              <Button
                key={cmd}
                variant="outline"
                size="sm"
                onClick={() => handleRunCommand(cmd)}
                disabled={execution?.status === 'running'}
              >
                {cmd}
              </Button>
            ))}
          </div>

          {/* Custom Command Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter command..."
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRunCommand(command)}
              className="font-mono text-sm"
            />
            <Button
              onClick={() => handleRunCommand(command)}
              disabled={execution?.status === 'running' || !command.trim()}
            >
              <Play className="h-4 w-4" />
            </Button>
          </div>

          {/* Command Output */}
          {execution && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">$ {execution.command}</span>
                {execution.status === 'running' && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
              </div>
              <pre className="text-xs font-mono overflow-auto max-h-64 p-2 bg-muted rounded whitespace-pre-wrap">
                {execution.output || (execution.status === 'running' ? 'Running...' : 'No output')}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button onClick={onContinue} data-testid="approve-continue-button">
          <Check className="h-4 w-4 mr-2" />
          Approve & Continue
        </Button>
      </div>
    </div>
  );
}
