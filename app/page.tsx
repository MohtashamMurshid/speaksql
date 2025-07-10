"use client";

import { useState, useEffect } from "react";
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

  const renderActiveTab = () => {
    switch (activeTab) {
      case "chat":
        return <DatabaseChat schema={databaseSchema} />;
      case "schema":
        return (
          <SchemaVisualizer
            schema={databaseSchema}
            onSchemaChange={setDatabaseSchema}
          />
        );
      case "query":
        return <QueryEditor schema={databaseSchema} />;
      case "import":
        return (
          <DataImporter
            onDataImported={handleDataImport}
            schema={databaseSchema}
            onSchemaChange={setDatabaseSchema}
          />
        );
      default:
        return null;
    }
  };

  const handleDataImport = (data: ImportedData) => {
    console.log("Data imported:", data);
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

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {tabs.map((tab) => {
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
