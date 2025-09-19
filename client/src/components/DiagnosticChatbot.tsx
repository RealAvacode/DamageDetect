import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Send, Upload, Bot, User, Loader2, Camera, Video, FileText } from 'lucide-react';
import type { AssessmentData, ChatMessage } from '@shared/schema';
import MediaUploader from './ImageUploader';
import { cn } from '@/lib/utils';

interface LocalChatMessage extends Omit<ChatMessage, 'files'> {
  files?: File[];
}

interface DiagnosticChatbotProps {
  className?: string;
}

export default function DiagnosticChatbot({ className }: DiagnosticChatbotProps) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your diagnostic assistant. I can help you assess laptop condition by analyzing images or videos. Upload your media or ask me questions about laptop diagnostics!",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: LocalChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue.trim(),
          conversationHistory: messages.slice(-5) // Send last 5 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const result = await response.json();
      
      const assistantMessage: LocalChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: LocalChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or upload files for analysis.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    const uploadMessage: LocalChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `Uploaded ${files.length} file(s) for analysis: ${files.map(f => f.name).join(', ')}`,
      timestamp: new Date(),
      files: files,
      isUploading: true
    };

    setMessages(prev => [...prev, uploadMessage]);
    setShowUploader(false);
    setIsLoading(true);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/assessments', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Assessment failed');
      }

      const result = await response.json();
      
      if (result.success) {
        const fileType = files[0].type;
        const isVideo = fileType.startsWith('video/');
        
        const assessmentData: AssessmentData = {
          grade: result.assessment.grade,
          confidence: result.assessment.confidence,
          damageTypes: result.assessment.damageTypes || [],
          overallCondition: result.assessment.damageDescription || result.overallCondition,
          detailedFindings: result.assessment.detailedFindings || result.detailedFindings || [],
          processingTime: result.assessment.processingTime,
          mediaUrl: URL.createObjectURL(files[0]),
          mediaType: isVideo ? 'video' : 'image',
          videoMetadata: result.assessment.videoMetadata
        };

        // Generate conversational response about the assessment
        const chatResponse = await fetch('/api/chat/interpret-assessment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assessment: assessmentData,
            filename: files[0].name
          }),
        });

        let assistantResponse = "I've completed the analysis!";
        if (chatResponse.ok) {
          const chatResult = await chatResponse.json();
          assistantResponse = chatResult.response;
        }

        const assistantMessage: LocalChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date(),
          assessment: assessmentData
        };

        // Update the upload message to remove loading state
        setMessages(prev => prev.map(msg => 
          msg.id === uploadMessage.id 
            ? { ...msg, isUploading: false }
            : msg
        ).concat([assistantMessage]));
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage: LocalChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      
      setMessages(prev => prev.map(msg => 
        msg.id === uploadMessage.id 
          ? { ...msg, isUploading: false }
          : msg
      ).concat([errorMessage]));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className={cn("flex flex-col h-[600px]", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Diagnostic Assistant</h3>
          <Badge variant="outline" className="ml-auto">
            AI-Powered
          </Badge>
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={cn(
                "flex gap-3",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}>
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src="/bot-avatar.png" alt="Assistant" />
                    <AvatarFallback>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={cn(
                  "max-w-[80%] space-y-1",
                  message.role === 'user' && "flex flex-col items-end"
                )}>
                  <div className={cn(
                    "rounded-lg px-3 py-2 break-words",
                    message.role === 'user' 
                      ? "bg-primary text-primary-foreground ml-auto" 
                      : "bg-muted"
                  )}>
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                    
                    {message.files && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {message.files.map((file, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {file.type.startsWith('image/') ? (
                              <Camera className="h-3 w-3 mr-1" />
                            ) : file.type.startsWith('video/') ? (
                              <Video className="h-3 w-3 mr-1" />
                            ) : (
                              <FileText className="h-3 w-3 mr-1" />
                            )}
                            {file.name}
                          </Badge>
                        ))}
                        {message.isUploading && (
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {message.assessment && (
                    <Card className="mt-2 w-full">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={
                            message.assessment.grade === 'A' ? 'default' :
                            message.assessment.grade === 'B' ? 'secondary' :
                            message.assessment.grade === 'C' ? 'secondary' : 'destructive'
                          }>
                            Grade {message.assessment.grade}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(message.assessment.confidence * 100)}% confidence
                          </span>
                        </div>
                        
                        {message.assessment.damageTypes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {message.assessment.damageTypes.map((type, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {message.assessment.mediaType && (
                          <div className="aspect-video bg-muted rounded overflow-hidden">
                            {message.assessment.mediaType === 'video' ? (
                              <video
                                src={message.assessment.mediaUrl}
                                controls
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={message.assessment.mediaUrl}
                                alt="Assessed item"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                
                {message.role === 'user' && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start gap-3">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <Separator />
        
        {/* File Upload Area */}
        {showUploader && (
          <div className="p-4 border-t bg-muted/30">
            <MediaUploader
              onFilesSelected={handleFilesSelected}
              maxFiles={1}
              acceptedTypes="both"
              disabled={isLoading}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploader(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {/* Input Area */}
        <div className="p-4 space-y-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me about laptop diagnostics or upload files for analysis..."
              disabled={isLoading}
              data-testid="chat-input"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              data-testid="send-button"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploader(!showUploader)}
              disabled={isLoading}
              data-testid="upload-button"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}