"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CardHeader } from "@/components/ui/card";
import {
  Mic,
  MicOff,
  Send,
  Bot,
  User,
  Loader2,
  Copy,
  Play,
  RefreshCw,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

interface DatabaseChatProps {
  schema: TableSchema[];
}

interface SpeechRecognitionEvent {
  results: Array<Array<{ transcript: string }>>;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

export function DatabaseChat({ schema }: DatabaseChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    reload,
  } = useChat({
    api: "/api/chat",
    body: {
      schema: schema,
    },
    onFinish: () => {
      scrollToBottom();
    },
  });

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => {
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, [setInput]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const extractSqlQuery = (content: string) => {
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/);
    return sqlMatch ? sqlMatch[1] : null;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-[700px]">
      {/* Header */}
      <CardHeader className="pb-4">
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

      {/* Schema Overview */}
      {schema.length > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-lg mx-6">
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
      <ScrollArea className="flex-1 px-6">
        <div className="space-y-4">
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
                    Import CSV files to start chatting with your data
                  </p>
                  <div className="max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground">
                      Go to the &quot;Import Data&quot; tab to upload your CSV
                      files, then return here to ask questions about your data
                      in natural language.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 p-4 rounded-lg",
                message.role === "user" ? "bg-secondary ml-8" : "bg-muted mr-8"
              )}
            >
              <div className="flex-shrink-0">
                {message.role === "user" ? (
                  <div className="p-2 bg-primary rounded-lg">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="p-2 bg-accent rounded-lg">
                    <Bot className="h-4 w-4 text-accent-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {message.role === "user" ? "You" : "AI Assistant"}
                  </span>
                </div>
                <div className="prose prose-sm max-w-none text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ ...props }) => (
                        <pre
                          className="whitespace-pre-wrap font-sans"
                          {...props}
                        />
                      ),
                      code: ({ className, children, ...props }) => {
                        const inline = "inline" in props ? props.inline : false;
                        return (
                          <code
                            className={cn(
                              className,
                              !inline && "block bg-muted px-2 py-1 rounded"
                            )}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.role === "assistant" && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(message.content)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {extractSqlQuery(message.content) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const query = extractSqlQuery(message.content);
                          if (query) console.log("Execute query:", query);
                        }}
                      >
                        <Play className="h-3 w-3" />
                        Execute
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

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
      <div className="p-6 border-t border-border">
        <form onSubmit={handleFormSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me anything about your database..."
              className="resize-none pr-12"
              rows={2}
              disabled={isLoading}
            />
            {isSupported && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 text-destructive" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <Button type="submit" disabled={!input.trim() || isLoading} size="lg">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {isListening && (
          <p className="text-sm text-primary mt-2 text-center">
            🎤 Listening... Speak your question
          </p>
        )}
      </div>
    </div>
  );
}
