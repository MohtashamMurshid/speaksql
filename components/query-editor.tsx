"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Download, Copy, Trash2, Save, FileText } from "lucide-react";

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
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

export function QueryEditor({ schema }: QueryEditorProps) {
  const [query, setQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    {
      name: "List all users",
      sql: "SELECT * FROM users LIMIT 10;",
    },
    {
      name: "Users with orders",
      sql: `SELECT u.name, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email
ORDER BY order_count DESC;`,
    },
    {
      name: "Recent orders",
      sql: `SELECT o.id, u.name, o.product_name, o.amount, o.order_date
FROM orders o
JOIN users u ON o.user_id = u.id
ORDER BY o.order_date DESC
LIMIT 20;`,
    },
    {
      name: "Monthly revenue",
      sql: `SELECT 
  DATE_FORMAT(order_date, '%Y-%m') as month,
  SUM(amount) as total_revenue,
  COUNT(*) as order_count
FROM orders 
GROUP BY DATE_FORMAT(order_date, '%Y-%m')
ORDER BY month DESC;`,
    },
  ];

  const executeQuery = async () => {
    if (!query.trim()) return;

    setIsExecuting(true);
    setError(null);

    try {
      // Simulate query execution
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock result for demonstration
      const mockResult: QueryResult = {
        columns: ["id", "name", "email", "created_at"],
        rows: [
          [1, "John Doe", "john@example.com", "2024-01-15T10:30:00Z"],
          [2, "Jane Smith", "jane@example.com", "2024-01-16T14:22:00Z"],
          [3, "Bob Johnson", "bob@example.com", "2024-01-17T09:15:00Z"],
        ],
        rowCount: 3,
        executionTime: 45,
      };

      setResult(mockResult);
    } catch (err) {
      setError("Query execution failed: " + (err as Error).message);
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
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            SQL Query Editor
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Execute SQL queries with AI assistance and syntax highlighting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyQuery}>
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={clearQuery}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Schema Reference */}
      {schema.length > 0 && (
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
                        <span className="text-gray-700 dark:text-gray-300">
                          {column.name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {column.type}
                        </span>
                      </div>
                    ))}
                    {table.columns.length > 4 && (
                      <div className="text-xs text-gray-500">
                        +{table.columns.length - 4} more...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample Queries */}
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
                  <div className="text-xs text-gray-500 truncate">
                    {sample.sql.split("\n")[0]}...
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

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
                {isExecuting ? "Executing..." : "Execute"}
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

      {/* Results */}
      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
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
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {result.rowCount} rows returned in {result.executionTime}ms
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadResults}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                    <tr
                      key={index}
                      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="p-2">
                          {cell?.toString() || "NULL"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
