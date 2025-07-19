"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { DatabaseChat } from "@/components/database-chat";
import { SchemaVisualizer } from "@/components/schema-visualizer";
import { QueryEditor } from "@/components/query-editor";
import { DataImporter } from "@/components/data-importer";
import { ModeToggle } from "@/components/mode-toggle";
import { Database, MessageSquare, Code, Upload } from "lucide-react";
import { databaseService } from "@/lib/database-service";

type Tab = "chat" | "schema" | "query" | "import";

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
  schema?: Array<{
    name: string;
    columns: Array<{ name: string; type?: string }>;
  }>;
  sampleData?: {
    tableName: string;
    columns: string[];
    rows: string[][];
    totalRows: number;
  }[];
}

interface ImportedData {
  fileName: string;
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    sample: string;
  }>;
  rowCount: number;
  preview: string[][];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("import");
  const [databaseSchema, setDatabaseSchema] = useState<TableSchema[]>([]);
  const [activeConnection, setActiveConnection] =
    useState<DatabaseConnection | null>(null);
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);

  // Initialize database service
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await databaseService.initializeCsvDatabase();
        // Load existing schema if any
        const schema = await databaseService.getSchema();
        setDatabaseSchema(schema);
      } catch (error) {
        console.error("Failed to initialize database:", error);
      }
    };

    initializeDatabase();
  }, []);

  // Handle connection changes from DatabaseConnector
  const handleConnectionChange = useCallback(
    (
      updatedConnections: DatabaseConnection[],
      activeConnectionId: string | null
    ) => {
      setConnections(updatedConnections);

      if (activeConnectionId) {
        const activeConn = updatedConnections.find(
          (conn) => conn.id === activeConnectionId
        );
        setActiveConnection(activeConn || null);

        // If the connection has a schema, use it; otherwise keep CSV schema
        if (activeConn?.schema) {
          // Convert the API schema format to our TableSchema format
          const convertedSchema: TableSchema[] = activeConn.schema.map(
            (table: {
              name: string;
              columns: Array<{ name: string; type?: string }>;
            }) => ({
              name: table.name,
              columns: table.columns.map(
                (col: { name: string; type?: string }) => ({
                  name: col.name,
                  type: col.type || "TEXT",
                  primaryKey: false, // API doesn't provide this info in current format
                })
              ),
            })
          );
          setDatabaseSchema(convertedSchema);
        }
      } else {
        setActiveConnection(null);
        // Reset to CSV schema when no SQL connection is active
        databaseService
          .getSchema()
          .then(setDatabaseSchema)
          .catch(console.error);
        setActiveTab("import");
      }
    },
    []
  );

  const tabs = [
    {
      id: "chat" as Tab,
      label: "AI Chat",
      icon: MessageSquare,
      description: "Chat with your database in plain English",
    },
    {
      id: "schema" as Tab,
      label: "Schema Visualizer",
      icon: Database,
      description: "Interactive database schema graph",
    },
    {
      id: "query" as Tab,
      label: "SQL Editor",
      icon: Code,
      description: "Execute SQL queries with AI assistance",
    },
    {
      id: "import" as Tab,
      label: "Import Data",
      icon: Upload,
      description: "Import CSV and other data formats",
    },
  ];

  const visibleTabs = activeConnection
    ? tabs
    : tabs.filter((tab) => tab.id === "import");

  const renderActiveTab = () => {
    switch (activeTab) {
      case "chat":
        if (activeConnection) {
          return (
            <DatabaseChat
              schema={databaseSchema}
              activeConnection={activeConnection || undefined}
            />
          );
        }
        return null;
      case "schema":
        if (activeConnection) {
          return (
            <SchemaVisualizer
              schema={databaseSchema}
              onSchemaChange={setDatabaseSchema}
            />
          );
        }
        return null;
      case "query":
        if (activeConnection) {
          return (
            <QueryEditor
              schema={databaseSchema}
              activeConnectionId={activeConnection?.id || null}
            />
          );
        }
        return null;
      case "import":
        return (
          <DataImporter
            onDataImported={handleDataImport}
            schema={databaseSchema}
            onSchemaChange={setDatabaseSchema}
            onConnectionChange={handleConnectionChange}
          />
        );
      default:
        return null;
    }
  };

  const handleDataImport = (data: ImportedData) => {
    console.log("Data imported:", data);
    // Log connections count for reference
    console.log(`Active connections: ${connections.length}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header with Theme Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Database className="h-10 w-10 text-primary" />
              <h1 className="text-5xl font-bold text-primary">SpeakSQL</h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Chat with your database in plain English • Visualize schemas
              interactively • Execute SQL with AI assistance
            </p>
          </div>
          <div className="absolute top-6 right-6">
            <ModeToggle />
          </div>
        </div>

        {/* Global Database Status Bar */}
        {activeConnection && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">
                    Connected Database: {activeConnection.name}
                  </span>
                  {activeConnection.connected ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Online
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                        Disconnected
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {activeConnection.type === "sqlite"
                    ? activeConnection.config.filePath
                    : `${activeConnection.config.host}:${activeConnection.config.port}/${activeConnection.config.database}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {databaseSchema.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {databaseSchema.length} table
                    {databaseSchema.length !== 1 ? "s" : ""} loaded
                  </div>
                )}
                <div className="text-xs px-2 py-1 bg-accent rounded">
                  {activeConnection.type.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                size="lg"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 transition-all duration-200 ${
                  activeTab === tab.id
                    ? "shadow-lg scale-105"
                    : "hover:scale-105 hover:shadow-md"
                }`}
              >
                <Icon className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">{tab.label}</div>
                  <div className="text-xs opacity-80 hidden sm:block">
                    {tab.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="p-6">{renderActiveTab()}</div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          Built with Next.js, Vercel AI SDK, React Flow, and shadcn/ui
        </div>
      </div>
    </div>
  );
}
