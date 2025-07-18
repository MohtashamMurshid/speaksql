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
  Play,
  RefreshCw,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { SpeechRecorder } from "@/components/speech-recorder";

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

interface QueryResult {
  columns: string[];
  rows: Record<string, string>[];
  rowCount: number;
  executionTime: number;
}

// --- Tool Call Message Type ---
interface ToolCallMessage {
  id: string;
  role: "tool";
  toolType: string;
  status: "pending" | "success" | "error";
  input: string;
  output?: QueryResult;
  error?: string;
}

export function DatabaseChat({ schema, activeConnection }: DatabaseChatProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  // Remove old queryResults/queryError state
  // const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  // const [queryError, setQueryError] = useState<string | null>(null);
  const [toolMessages, setToolMessages] = useState<ToolCallMessage[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);

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

  const extractSqlQuery = (content: string) => {
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch && sqlMatch[1]) {
      return sqlMatch[1].trim();
    }

    const altSqlMatch = content.match(/```sql([\s\S]*?)\n```/);
    if (altSqlMatch && altSqlMatch[1]) {
      return altSqlMatch[1].trim();
    }

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

  // --- Tool Call Execution ---
  const executeQuery = async (query: string) => {
    if (!activeConnection?.connected) {
      // Add error tool message
      const errorMsg: ToolCallMessage = {
        id: `tool-${Date.now()}`,
        role: "tool",
        toolType: "sql-query",
        status: "error",
        input: query,
        error: "No active database connection to execute queries",
      };
      setToolMessages((prev) => [...prev, errorMsg]);
      return;
    }
    const toolMsgId = `tool-${Date.now()}`;
    // Add pending tool message
    setToolMessages((prev) => [
      ...prev,
      {
        id: toolMsgId,
        role: "tool",
        toolType: "sql-query",
        status: "pending",
        input: query,
      },
    ]);
    setIsExecuting(true);
    try {
      const response = await fetch("/api/database/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeConnection.type,
          config: activeConnection.config,
          query: query,
        }),
      });
      const data = await response.json();
      if (data.error) {
        setToolMessages((prev) =>
          prev.map((msg) =>
            msg.id === toolMsgId
              ? { ...msg, status: "error", error: data.error }
              : msg
          )
        );
      } else {
        setToolMessages((prev) =>
          prev.map((msg) =>
            msg.id === toolMsgId
              ? { ...msg, status: "success", output: data.results }
              : msg
          )
        );
      }
    } catch (err) {
      setToolMessages((prev) =>
        prev.map((msg) =>
          msg.id === toolMsgId
            ? {
                ...msg,
                status: "error",
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to execute query",
              }
            : msg
        )
      );
    } finally {
      setIsExecuting(false);
    }
  };

  // --- Tool Call Message Renderer ---
  const renderToolCallMessage = (msg: ToolCallMessage) => {
    return (
      <div
        key={msg.id}
        className={cn(
          "flex gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 mr-8 border border-yellow-200 dark:border-yellow-800"
        )}
      >
        <div className="flex-shrink-0">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <Play className="h-4 w-4 text-yellow-700 dark:text-yellow-200" />
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-200">
              Tool Call: {msg.toolType}
            </span>
            <span className="text-xs">
              {msg.status === "pending" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />
                  Running...
                </>
              )}
              {msg.status === "success" && (
                <span className="text-green-700 dark:text-green-300">
                  Success
                </span>
              )}
              {msg.status === "error" && (
                <span className="text-red-700 dark:text-red-300">Error</span>
              )}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Input:</span>
            <pre className="bg-muted rounded p-2 text-xs mt-1 overflow-x-auto">
              {msg.input}
            </pre>
          </div>
          {msg.status === "success" &&
            msg.output &&
            Array.isArray(msg.output.columns) &&
            Array.isArray(msg.output.rows) && (
              <div>
                <span className="text-xs text-muted-foreground">Output:</span>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr>
                        {msg.output.columns.map((column) => (
                          <th
                            key={column}
                            className="px-4 py-2 text-left text-xs font-medium text-muted-foreground bg-muted"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {msg.output.rows.map((row, i) => (
                        <tr key={i}>
                          {msg.output?.columns.map((column, j) => (
                            <td
                              key={j}
                              className="px-4 py-2 text-xs whitespace-nowrap"
                            >
                              {row[column]?.toString() || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground mt-2">
                    {msg.output?.rowCount} rows returned
                  </p>
                </div>
              </div>
            )}
          {msg.status === "error" && msg.error && (
            <p className="text-xs text-red-500 mt-2">{msg.error}</p>
          )}
        </div>
      </div>
    );
  };

  // --- Render Messages (including tool calls) ---
  const renderMessages = () => {
    // Merge chat messages and toolMessages, sorted by id timestamp
    type ChatMessage = (typeof messages)[number];
    const allMessages: (ChatMessage | ToolCallMessage)[] = [
      ...messages,
      ...toolMessages,
    ].sort((a, b) => {
      // Extract timestamp from id if possible
      const getTs = (m: { id: string }) => {
        if (typeof m.id === "string" && m.id.startsWith("tool-")) {
          return parseInt(m.id.replace("tool-", ""), 10);
        }
        if (typeof m.id === "string") {
          return parseInt(m.id.split("-").pop() || "0", 10);
        }
        return 0;
      };
      return getTs(a) - getTs(b);
    });
    return allMessages.map((message) => {
      if ((message as ToolCallMessage).role === "tool") {
        return renderToolCallMessage(message as ToolCallMessage);
      }
      // ... existing code for user/assistant messages ...
      return (
        <div
          key={message.id}
          className={cn(
            "flex gap-3 p-4 rounded-lg",
            (message as ChatMessage).role === "assistant"
              ? "bg-muted mr-8"
              : "bg-primary/10 ml-8"
          )}
        >
          <div className="flex-shrink-0">
            <div className="p-2 bg-accent rounded-lg">
              {(message as ChatMessage).role === "assistant" ? (
                <Bot className="h-4 w-4 text-accent-foreground" />
              ) : (
                <User className="h-4 w-4 text-accent-foreground" />
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {(message as ChatMessage).content}
            </ReactMarkdown>
            {(message as ChatMessage).role === "assistant" &&
              extractSqlQuery((message as ChatMessage).content) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const query = extractSqlQuery(
                      (message as ChatMessage).content
                    );
                    if (query) executeQuery(query);
                  }}
                  className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-800 dark:hover:text-blue-200 border border-blue-200 dark:border-blue-800"
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  <span className="text-xs">
                    {isExecuting ? "Running..." : "Run Query"}
                  </span>
                </Button>
              )}
          </div>
        </div>
      );
    });
  };

  // Check if we have either a connected database or schema data from uploads
  const canInteract = activeConnection?.connected || (schema && schema.length > 0);

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
        <form onSubmit={handleFormSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder={
                canInteract
                  ? "Ask me anything about your database..."
                  : "Connect to a database or upload data to start chatting"
              }
              className="resize-none max-h-[150px] pr-10"
              rows={2}
              disabled={isLoading || !canInteract}
            />
            <div className="absolute bottom-2 right-2">
              <SpeechRecorder 
                onTranscription={(text, autoSubmit) => {
                  handleInputChange({ target: { value: text } } as React.ChangeEvent<HTMLTextAreaElement>);
                  
                  // Auto-submit the form if requested
                  if (autoSubmit && text.trim() && canInteract && !isLoading) {
                    // Use setTimeout to ensure React has updated the input value first
                    setTimeout(() => {
                      // Simulate a click on the submit button
                      if (sendButtonRef.current) {
                        sendButtonRef.current.click();
                      }
                    }, 100);
                  }
                }}
                disabled={isLoading || !canInteract}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={
              !input.trim() || isLoading || !canInteract
            }
            size="lg"
            ref={sendButtonRef}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
