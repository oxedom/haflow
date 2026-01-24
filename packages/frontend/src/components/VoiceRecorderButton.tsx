import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn } from '@/lib/utils';

interface VoiceRecorderButtonProps {
  onTranscription: (text: string) => void;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
}

export function VoiceRecorderButton({
  onTranscription,
  size = 'icon',
  className,
  disabled = false,
}: VoiceRecorderButtonProps) {
  const { isRecording, isProcessing, audioLevel, error, toggleRecording } = useVoiceRecorder({
    onTranscription,
  });

  const isDisabled = disabled || isProcessing;

  return (
    <div className="relative inline-flex items-center">
      {/* Audio level ring (visible when recording) */}
      {isRecording && (
        <div
          className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse"
          style={{
            transform: `scale(${1 + audioLevel * 0.5})`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}

      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size={size}
        onClick={toggleRecording}
        disabled={isDisabled}
        className={cn('relative z-10', className)}
        title={error || (isRecording ? 'Stop recording' : 'Start recording')}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
