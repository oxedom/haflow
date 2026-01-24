import { useState, useRef, useEffect, useCallback } from 'react';
import { Headphones, Send, Mic, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VoiceRecorderButton } from './VoiceRecorderButton';
import { cn } from '@/lib/utils';

interface ChatVoiceProps {
  onSubmitMessage?: (message: string) => Promise<string | void>;
  title?: string;
  welcomeMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isVoice?: boolean;
  timestamp: Date;
}

export function ChatVoice({
  onSubmitMessage,
  title = 'Voice Chat',
  welcomeMessage = 'Hello! You can type or use voice input.',
}: ChatVoiceProps) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'system',
      content: welcomeMessage,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const addMessage = useCallback((role: Message['role'], content: string, isVoice = false) => {
    const newMessage: Message = {
      id: `${role}-${Date.now()}`,
      role,
      content,
      isVoice,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const handleSendMessage = useCallback(async (content: string, isVoice = false) => {
    if (!content.trim() || isLoading) return;

    addMessage('user', content, isVoice);
    setInputValue('');
    setIsLoading(true);

    try {
      if (onSubmitMessage) {
        const response = await onSubmitMessage(content);
        if (response) {
          addMessage('assistant', response);
        }
      }
    } catch (error) {
      addMessage('system', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, onSubmitMessage, addMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  }, [inputValue, handleSendMessage]);

  const handleVoiceTranscription = useCallback((text: string) => {
    handleSendMessage(text, true);
  }, [handleSendMessage]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-shrink-0 py-3 px-4 border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Headphones className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea ref={scrollRef} className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.role === 'assistant'
                      ? 'bg-muted'
                      : 'bg-muted/50 text-muted-foreground text-xs'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {message.isVoice && message.role === 'user' && (
                      <Mic className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="flex-shrink-0 p-3 border-t gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isLoading}
          className="flex-1"
        />
        <VoiceRecorderButton
          onTranscription={handleVoiceTranscription}
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={() => handleSendMessage(inputValue)}
          disabled={!inputValue.trim() || isLoading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
