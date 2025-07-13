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
  Check,
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedSqlIndex, setCopiedSqlIndex] = useState<string | null>(null);
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

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const extractSqlQuery = (content: string) => {
    // First try to match SQL code blocks with ```sql format
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch && sqlMatch[1]) {
      return sqlMatch[1].trim();
    }
    
    // Try alternate format with no newline after language declaration
    const altSqlMatch = content.match(/```sql([\s\S]*?)\n```/);
    if (altSqlMatch && altSqlMatch[1]) {
      return altSqlMatch[1].trim();
    }
    
    // If no match found, try to detect SQL patterns
    const sqlPatterns = [
      /SELECT[\s\S]*?FROM[\s\S]*?(?:;|$)/i,
      /INSERT\s+INTO[\s\S]*?VALUES[\s\S]*?(?:;|$)/i,
      /UPDATE[\s\S]*?SET[\s\S]*?(?:;|$)/i,
      /DELETE\s+FROM[\s\S]*?(?:;|$)/i,
      /CREATE\s+TABLE[\s\S]*?(?:;|$)/i,
      /ALTER\s+TABLE[\s\S]*?(?:;|$)/i,
      /DROP\s+TABLE[\s\S]*?(?:;|$)/i,
    ];
    
    for (const pattern of sqlPatterns) {
      const match = content.match(pattern);
      if (match && match[0]) {
        return match[0].trim();
      }
    }
    
    return null;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-[700px] overflow-hidden">
      {/* Add animation styles */}
      <style jsx global>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-fade-in-out {
          animation: fadeInOut 2s ease-in-out;
        }
      `}</style>
      
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
                        const isSql = className?.includes('language-sql');
                        
                        // If it's an inline code block
                        if (inline) {
                          return (
                            <code
                              className={cn(
                                className,
                                "bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono"
                              )}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        
                        // If it's a SQL code block
                        if (isSql) {
                          // Generate a unique index for this SQL block
                          const sqlIndex = `${message.id}-${Math.random().toString(36).substring(2, 9)}`;
                          const sqlContent = String(children).trim();
                          
                          const handleCopy = () => {
                            navigator.clipboard.writeText(sqlContent);
                            setCopiedSqlIndex(sqlIndex);
                            setTimeout(() => setCopiedSqlIndex(null), 2000);
                          };
                          
                          return (
                            <div className="relative mt-2 mb-4">
                              <div className="absolute top-0 right-0 bg-blue-500 text-white px-2 py-1 text-xs rounded-bl z-10 flex items-center gap-1">
                                <span>{copiedSqlIndex === sqlIndex ? "Copied" : "Copy"}</span>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-5 w-5 p-0 bg-blue-600 hover:bg-blue-700 rounded-full ml-1 flex items-center justify-center"
                                  onClick={handleCopy}
                                  title="Copy SQL"
                                >
                                  {copiedSqlIndex === sqlIndex ? (
                                    <Check className="h-2.5 w-2.5 text-white" />
                                  ) : (
                                    <Copy className="h-2.5 w-2.5 text-white" />
                                  )}
                                </Button>
                              </div>
                              <div 
                                className={cn(
                                  "cursor-pointer transition-all duration-200",
                                  copiedSqlIndex === sqlIndex && "ring-2 ring-green-500"
                                )}
                                onClick={handleCopy}
                                title="Click to copy SQL"
                              >
                                {copiedSqlIndex === sqlIndex && (
                                  <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center z-10 rounded-lg">
                                    <div className="bg-green-100 text-green-800 px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 shadow-lg">
                                      <Check className="h-4 w-4" />
                                      Copied to clipboard!
                                    </div>
                                  </div>
                                )}
                                <code
                                  className={cn(
                                    className,
                                    "block bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono border-l-4 border-blue-500 pl-4 mt-6 shadow-md whitespace-pre-wrap"
                                  )}
                                  {...props}
                                >
                                  {children}
                                </code>
                              </div>
                            </div>
                          );
                        }
                        
                        // Regular code block
                        return (
                          <code
                            className={cn(
                              className,
                              "block bg-muted px-2 py-1 rounded"
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
                      onClick={() => copyToClipboard(message.content, message.id)}
                      disabled={copiedMessageId === message.id}
                      className="flex items-center gap-1"
                    >
                      {copiedMessageId === message.id ? (
                        <>
                          <Check className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </Button>
                    {extractSqlQuery(message.content) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const query = extractSqlQuery(message.content);
                          if (query) console.log("Execute query:", query);
                        }}
                        className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-800 dark:hover:text-blue-200 border border-blue-200 dark:border-blue-800"
                      >
                        <Play className="h-3 w-3" />
                        <span className="text-xs">Run Query</span>
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
      <div className="p-6 border-t border-border flex-shrink-0">
        <form onSubmit={handleFormSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me anything about your database..."
              className="resize-none pr-12 max-h-[150px]"
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
