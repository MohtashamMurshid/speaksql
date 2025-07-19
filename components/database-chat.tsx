"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CardHeader } from "@/components/ui/card";
import {
  Send,
  Bot,
  User,
  Loader2,
  RefreshCw,
  Database,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";

interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    primaryKey?: boolean;
    foreignKey?: {
      table: string;
      column: string;
    };
  }>;
}

interface DatabaseConnection {
  id: string;
  name: string;
  type: "postgresql" | "mysql" | "sqlite";
  connected: boolean;
  config: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    filePath?: string;
  };
  error?: string;
  schema?: {
    name: string;
    columns: { name: string }[];
  }[];
  sampleData?: {
    tableName: string;
    columns: string[];
    rows: string[][];
    totalRows: number;
  }[];
}

interface DatabaseChatProps {
  schema: TableSchema[];
  activeConnection?: DatabaseConnection;
}

export function DatabaseChat({ schema, activeConnection }: DatabaseChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    reload,
  } = useChat({
    api: "/api/chat",
    body: {
      schema: schema,
      activeConnection: activeConnection,
    },
    onFinish: () => {
      scrollToBottom();
    },
  });

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  };

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        audioChunksRef.current = [];
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");

        setIsTranscribing(true);
        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          if (response.ok) {
            const syntheticEvent = {
              target: { value: data.text },
              currentTarget: { value: data.text },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          } else {
            console.error("Transcription error:", data.error);
          }
        } catch (error) {
          console.error("Error sending audio for transcription:", error);
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  // --- Render Messages ---
  const renderMessages = () => {
    return messages.map((message) => {
      return (
        <div
          key={message.id}
          className={cn(
            "flex gap-3 p-4 rounded-lg",
            message.role === "assistant"
              ? "bg-muted mr-8"
              : "bg-primary/10 ml-8"
          )}
        >
          <div className="flex-shrink-0">
            <div className="p-2 bg-accent rounded-lg">
              {message.role === "assistant" ? (
                <Bot className="h-4 w-4 text-accent-foreground" />
              ) : (
                <User className="h-4 w-4 text-accent-foreground" />
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-[700px] overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent rounded-lg">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Database AI Assistant
            </h2>
            <p className="text-sm text-muted-foreground">
              Ask questions about your data in plain English
            </p>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reload()}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Connection Status */}
      {activeConnection && (
        <div className="mb-4 p-3 bg-muted rounded-lg mx-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Connected to: {activeConnection.name}
            </span>
            {activeConnection.connected ? (
              <Badge
                variant="secondary"
                className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Schema Overview */}
      {schema.length > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-lg mx-6 flex-shrink-0">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Available Tables:
          </h3>
          <div className="flex flex-wrap gap-2">
            {schema.map((table) => (
              <span
                key={table.name}
                className="px-2 py-1 bg-accent text-accent-foreground text-xs rounded-md font-medium"
              >
                {table.name} ({table.columns.length} columns)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 overflow-y-auto">
        <div className="space-y-4 pb-6">
          {messages.length === 0 && (
            <div className="text-center py-8">
              {schema.length > 0 ? (
                <>
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Welcome to SpeakSQL!
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Ask me anything about your database. I can help you:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md mx-auto text-sm">
                    <div className="p-2 bg-accent rounded text-accent-foreground">
                      Generate SQL queries
                    </div>
                    <div className="p-2 bg-accent rounded text-accent-foreground">
                      Explain data relationships
                    </div>
                    <div className="p-2 bg-accent rounded text-accent-foreground">
                      Analyze data patterns
                    </div>
                    <div className="p-2 bg-accent rounded text-accent-foreground">
                      Optimize queries
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No Data Available
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Connect to a database or import CSV files to start chatting
                  </p>
                  <div className="max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground">
                      Go to the &quot;Database Connections&quot; tab to connect
                      to your database, or use the &quot;Import Data&quot; tab
                      to upload CSV files.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {renderMessages()}

          {isLoading && (
            <div className="flex gap-3 p-4 rounded-lg bg-muted mr-8">
              <div className="flex-shrink-0">
                <div className="p-2 bg-accent rounded-lg">
                  <Bot className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    AI is thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={scrollAreaRef} />
      </ScrollArea>

      {/* Input Form */}
      <div className="p-6 border-t border-border flex-shrink-0">
        <form onSubmit={handleFormSubmit} className="relative">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder={
              activeConnection?.connected
                ? "Ask me anything about your database..."
                : "Connect to a database to start chatting"
            }
            className="pr-20"
            rows={2}
            disabled={isLoading || !activeConnection?.connected}
          />
          <div className="absolute right-2 bottom-2 flex space-x-2">
            <Button type="submit" size="icon" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={handleMicClick}
              variant={isRecording ? "destructive" : "outline"}
              className={cn({ "animate-intense-pulse": isRecording })}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
