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
  BarChart3,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartContainer } from "@/components/charts/chart-container";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  type: "postgresql" | "mysql" | "sqlite" | "csv";
  connected: boolean;
  config?: {
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
  rows: string[][];
  rowCount: number;
  executionTime: number;
}

export function DatabaseChat({ schema, activeConnection }: DatabaseChatProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [selectedChartData, setSelectedChartData] =
    useState<QueryResult | null>(null);
  const [suggestionsKey, setSuggestionsKey] = useState(0); // For refreshing suggestions
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

  // Function to extract query results from AI message content
  const extractQueryResults = (content: string) => {
    // Look for structured data that matches QueryResult format
    try {
      // Check if the message contains execution results from the AI tool
      const lines = content.split("\n");
      let queryData = null;

      // Look for result patterns in the AI response
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for table headers that indicate query results
        if (line.includes("|") && line.includes("---")) {
          // Extract table data
          const tableLines = [];
          let j = i - 1;

          // Get header line
          while (j >= 0 && lines[j].includes("|")) {
            tableLines.unshift(lines[j]);
            j--;
          }

          // Get data lines
          j = i + 1;
          while (j < lines.length && lines[j].includes("|")) {
            tableLines.push(lines[j]);
            j++;
          }

          if (tableLines.length >= 2) {
            const columns = tableLines[0]
              .split("|")
              .map((col) => col.trim())
              .filter((col) => col);
            const rows = tableLines
              .slice(2)
              .map((row) =>
                row
                  .split("|")
                  .map((cell) => cell.trim())
                  .filter((cell) => cell)
              )
              .filter((row) => row.length > 0);

            if (columns.length > 0 && rows.length > 0) {
              queryData = {
                columns,
                rows,
                rowCount: rows.length,
                executionTime: 0,
              };
              break;
            }
          }
        }
      }

      return queryData;
    } catch {
      return null;
    }
  };

  const openChartDialog = (queryData: QueryResult) => {
    setSelectedChartData(queryData);
    setChartDialogOpen(true);
  };

  const closeChartDialog = () => {
    setChartDialogOpen(false);
    setSelectedChartData(null);
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

  // Function to generate intelligent suggested prompts based on schema
  const generateSuggestedPrompts = () => {
    if (schema.length === 0) return [];

    const prompts: string[] = [];

    // Get first few tables for suggestions
    const mainTables = schema.slice(0, 3);

    mainTables.forEach((table) => {
      // Basic table exploration prompts
      prompts.push(`Show me the first 10 rows from ${table.name}`);
      prompts.push(`What's the structure of the ${table.name} table?`);

      // Column-specific prompts
      const numericColumns = table.columns.filter(
        (col) =>
          col.type.toLowerCase().includes("int") ||
          col.type.toLowerCase().includes("decimal") ||
          col.type.toLowerCase().includes("float") ||
          col.type.toLowerCase().includes("number")
      );

      if (numericColumns.length > 0) {
        const column = numericColumns[0];
        prompts.push(`What's the average ${column.name} in ${table.name}?`);
        prompts.push(`Show me the distribution of ${column.name} values`);
      }

      // Date/time analysis
      const dateColumns = table.columns.filter(
        (col) =>
          col.type.toLowerCase().includes("date") ||
          col.type.toLowerCase().includes("time") ||
          col.type.toLowerCase().includes("timestamp")
      );

      if (dateColumns.length > 0) {
        const column = dateColumns[0];
        prompts.push(
          `Show me records from ${table.name} grouped by ${column.name}`
        );
        prompts.push(`Analyze trends over time using ${column.name}`);
      }

      // Text/categorical analysis
      const textColumns = table.columns.filter(
        (col) =>
          col.type.toLowerCase().includes("varchar") ||
          col.type.toLowerCase().includes("text") ||
          col.type.toLowerCase().includes("char")
      );

      if (textColumns.length > 1) {
        const column =
          textColumns.find((col) => !col.primaryKey) || textColumns[0];
        prompts.push(
          `What are the unique values in ${column.name} from ${table.name}?`
        );
        prompts.push(`Find the most common ${column.name} values`);
      }

      // Count records
      prompts.push(`How many records are in ${table.name}?`);
    });

    // Relationship-based prompts
    const tablesWithForeignKeys = schema.filter((table) =>
      table.columns.some((col) => col.foreignKey)
    );

    tablesWithForeignKeys.forEach((table) => {
      const fkColumn = table.columns.find((col) => col.foreignKey);
      if (fkColumn?.foreignKey) {
        prompts.push(
          `Show me ${table.name} data joined with ${fkColumn.foreignKey.table}`
        );
        prompts.push(
          `Analyze the relationship between ${table.name} and ${fkColumn.foreignKey.table}`
        );
      }
    });

    // Cross-table analysis
    if (schema.length > 1) {
      prompts.push(`Compare data across different tables`);
      prompts.push(`Show me a summary of all tables`);
      prompts.push(`Find relationships between tables`);
    }

    // Sample data specific prompts
    if (activeConnection?.sampleData) {
      const sampleTable = activeConnection.sampleData[0];
      if (sampleTable && sampleTable.rows.length > 0) {
        prompts.push(`Analyze patterns in ${sampleTable.tableName} data`);
        prompts.push(`Find duplicates in ${sampleTable.tableName}`);
        prompts.push(`Create a report for ${sampleTable.tableName}`);
      }
    }

    // Add some advanced analysis prompts
    prompts.push(`Help me optimize queries for better performance`);
    prompts.push(`Explain the database schema and relationships`);
    prompts.push(`Find potential data quality issues`);

    // Return a shuffled selection of prompts (max 6 for main display, 8 for dropdown)
    return prompts;
  };

  const allSuggestedPrompts = generateSuggestedPrompts();
  const mainSuggestedPrompts = allSuggestedPrompts
    .sort(() => Math.random() - 0.5 + suggestionsKey * 0) // Use key for deterministic shuffle
    .slice(0, 6);

  const dropdownSuggestedPrompts = allSuggestedPrompts
    .sort(() => Math.random() - 0.5 + suggestionsKey * 0.1) // Different shuffle
    .slice(0, 8);

  const handleSuggestionClick = (prompt: string) => {
    const syntheticEvent = {
      target: { value: prompt },
      currentTarget: { value: prompt },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(syntheticEvent);
  };

  const refreshSuggestions = () => {
    setSuggestionsKey((prev) => prev + 1);
  };

  // --- Render Messages ---
  const renderMessages = () => {
    return messages.map((message) => {
      const queryResults =
        message.role === "assistant"
          ? extractQueryResults(message.content)
          : null;
      // Remove chart visibility state - now using popup

      return (
        <div key={message.id} className="space-y-2">
          <div
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ ...props }) => (
                    <Table className="my-4" {...props} />
                  ),
                  thead: ({ ...props }) => <TableHeader {...props} />,
                  tbody: ({ ...props }) => <TableBody {...props} />,
                  tr: ({ ...props }) => <TableRow {...props} />,
                  th: ({ ...props }) => <TableHead {...props} />,
                  td: ({ ...props }) => <TableCell {...props} />,
                }}
              >
                {message.content}
              </ReactMarkdown>

              {/* Visualize Button - shown when message contains query results */}
              {queryResults && (
                <div className="flex justify-start mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openChartDialog(queryResults)}
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Visualize Data
                  </Button>
                </div>
              )}
            </div>
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
                  <p className="text-muted-foreground mb-6">
                    Ask me anything about your database. I can help you:
                  </p>

                  {/* Suggested Prompts */}
                  {mainSuggestedPrompts.length > 0 && (
                    <div className="max-w-2xl mx-auto">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-medium text-foreground">
                          Suggested questions for your data:
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={refreshSuggestions}
                          className="ml-auto h-6 px-2 text-xs"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          More
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {mainSuggestedPrompts.map((prompt, index) => (
                          <Button
                            key={`main-${suggestionsKey}-${index}`}
                            variant="outline"
                            className="h-auto p-3 text-left justify-start whitespace-normal"
                            onClick={() => handleSuggestionClick(prompt)}
                          >
                            <span className="text-sm">{prompt}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
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
              (activeConnection?.connected && schema.length > 0) ||
              (!activeConnection && schema.length > 0)
                ? "Ask me anything about your database..."
                : "Connect to a database or import CSV files to start chatting"
            }
            className="pr-32"
            rows={2}
            disabled={isLoading || schema.length === 0}
          />
          <div className="absolute right-2 bottom-2 flex space-x-2">
            {/* Suggestions Dropdown - only show when we have schema */}
            {schema.length > 0 && dropdownSuggestedPrompts.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={isLoading}
                  >
                    <Lightbulb className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 max-h-60 overflow-y-auto"
                >
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Suggested Questions
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={refreshSuggestions}
                        className="h-6 px-2 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        New
                      </Button>
                    </div>
                    {dropdownSuggestedPrompts.map((prompt, index) => (
                      <DropdownMenuItem
                        key={`${suggestionsKey}-${index}`}
                        onClick={() => handleSuggestionClick(prompt)}
                        className="cursor-pointer p-2 text-sm whitespace-normal h-auto"
                      >
                        {prompt}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              type="submit"
              size="icon"
              disabled={isLoading || schema.length === 0}
            >
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

      {/* Chart Popup Dialog */}
      <Dialog open={chartDialogOpen} onOpenChange={setChartDialogOpen}>
        <DialogContent className="max-w-5xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Data Visualization</DialogTitle>
          </DialogHeader>
          {selectedChartData && (
            <ChartContainer
              data={selectedChartData}
              onClose={closeChartDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
