"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Copy,
  Loader2,
  XCircle,
  Database,
  BarChart3,
} from "lucide-react";
import { databaseService } from "@/lib/database-service";
import { ChartContainer } from "@/components/charts/chart-container";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface QueryEditorProps {
  schema: TableSchema[];
  activeConnectionId: string | null;
}

interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTime: number;
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

export function QueryEditor({ schema, activeConnectionId }: QueryEditorProps) {
  const [query, setQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeConnection, setActiveConnection] =
    useState<DatabaseConnection | null>(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);

  // Load active connection from localStorage
  useEffect(() => {
    if (activeConnectionId) {
      const saved = localStorage.getItem("speaksql_connections");
      if (saved) {
        const connections: DatabaseConnection[] = JSON.parse(saved);
        const connection = connections.find(
          (conn) => conn.id === activeConnectionId
        );
        setActiveConnection(connection || null);
      }
    } else {
      setActiveConnection(null);
    }
  }, [activeConnectionId]);

  // Generate sample queries based on actual schema
  const sampleQueries =
    schema.length > 0
      ? [
          {
            name: `List all ${schema[0].name}`,
            sql: `SELECT * FROM ${schema[0].name} LIMIT 10;`,
          },
          ...(schema.length > 1
            ? [
                {
                  name: `Count records in ${schema[1].name}`,
                  sql: `SELECT COUNT(*) as total_count FROM ${schema[1].name};`,
                },
              ]
            : []),
          ...(schema.some((table) =>
            table.columns.some((col) => col.foreignKey)
          )
            ? [
                {
                  name: "Join tables",
                  sql: (() => {
                    const tableWithFK = schema.find((table) =>
                      table.columns.some((col) => col.foreignKey)
                    );
                    const fkColumn = tableWithFK?.columns.find(
                      (col) => col.foreignKey
                    );
                    if (tableWithFK && fkColumn?.foreignKey) {
                      return `SELECT t1.*, t2.*\nFROM ${tableWithFK.name} t1\nJOIN ${fkColumn.foreignKey.table} t2 ON t1.${fkColumn.name} = t2.${fkColumn.foreignKey.column}\nLIMIT 10;`;
                    }
                    return "";
                  })(),
                },
              ]
            : []),
        ].filter((query) => query.sql)
      : [];

  const executeQuery = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      let queryResult: QueryResult;

      if (activeConnection && activeConnection.connected) {
        // Execute query on SQL database via API
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
          throw new Error(data.error);
        }

        queryResult = data;
      } else {
        // Execute query on CSV data via databaseService
        queryResult = await databaseService.executeQuery(query);
      }

      setResult(queryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
  };

  const downloadResults = () => {
    if (!result) return;

    const csv = [
      result.columns.join(","),
      ...result.rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearQuery = () => {
    setQuery("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            SQL Query Editor
          </h2>
          <p className="text-muted-foreground">
            Execute SQL queries with AI assistance and syntax highlighting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyQuery}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={clearQuery}>
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Schema Reference */}
      {schema.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="font-semibold">Available Tables</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schema.map((table) => (
                <div key={table.name} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{table.name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {table.columns.length} cols
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    {table.columns.slice(0, 4).map((column) => (
                      <div key={column.name} className="flex justify-between">
                        <span className="text-foreground">{column.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {column.type}
                        </span>
                      </div>
                    ))}
                    {table.columns.length > 4 && (
                      <div className="text-xs text-muted-foreground">
                        +{table.columns.length - 4} more...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="font-semibold">Schema</h3>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Database Schema</p>
              <p>
                Import CSV files in the &quot;Import Data&quot; tab to get
                started
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Queries */}
      {sampleQueries.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="font-semibold">Sample Queries</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sampleQueries.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start h-auto p-3"
                  onClick={() => setQuery(sample.sql)}
                >
                  <div className="text-left">
                    <div className="font-medium">{sample.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {sample.sql.split("\n")[0]}...
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>
                No data available. Please import CSV files to see sample
                queries.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Query Editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">SQL Query</h3>
            <div className="flex gap-2">
              <Button
                onClick={executeQuery}
                disabled={isExecuting || !query.trim()}
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" />
                {isExecuting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Execute"
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your SQL query here..."
            className="font-mono min-h-[200px] resize-none"
            rows={8}
          />
        </CardContent>
      </Card>

      {/* Visualize Button - shown when we have results */}
      {result && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setChartDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Visualize Data
          </Button>
        </div>
      )}

      {/* Results */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <div className="font-semibold">Error:</div>
              <div>{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Query Results</h3>
                <p className="text-sm text-muted-foreground">
                  {result.rowCount} rows returned in {result.executionTime}ms
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadResults}>
                <Copy className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {result.columns.map((column) => (
                      <th key={column} className="text-left p-2 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="p-2">
                          {cell?.toString() || "NULL"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Chart Popup Dialog */}
      <Dialog open={chartDialogOpen} onOpenChange={setChartDialogOpen}>
        <DialogContent className="max-w-5xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Data Visualization</DialogTitle>
          </DialogHeader>
          {result && (
            <ChartContainer
              data={result}
              onClose={() => setChartDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
