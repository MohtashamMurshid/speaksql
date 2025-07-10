"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatabaseChat } from "@/components/database-chat";
import { SchemaVisualizer } from "@/components/schema-visualizer";
import { QueryEditor } from "@/components/query-editor";
import { DataImporter } from "@/components/data-importer";
import { Database, MessageSquare, Code, Upload } from "lucide-react";

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [databaseSchema, setDatabaseSchema] = useState<TableSchema[]>([
    // Sample schema for demonstration
    {
      name: "users",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true },
        { name: "name", type: "VARCHAR(255)" },
        { name: "email", type: "VARCHAR(255)" },
        { name: "created_at", type: "TIMESTAMP" },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true },
        {
          name: "user_id",
          type: "INTEGER",
          foreignKey: { table: "users", column: "id" },
        },
        { name: "product_name", type: "VARCHAR(255)" },
        { name: "amount", type: "DECIMAL(10,2)" },
        { name: "order_date", type: "TIMESTAMP" },
      ],
    },
  ]);

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

  const handleDataImport = (data: any) => {
    console.log("Data imported:", data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Database className="h-10 w-10 text-blue-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              SpeakSQL
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Chat with your database in plain English • Visualize schemas
            interactively • Execute SQL with AI assistance
          </p>
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
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg scale-105"
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6">{renderActiveTab()}</div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          Built with Next.js, Vercel AI SDK, React Flow, and shadcn/ui
        </div>
      </div>
    </div>
  );
}
