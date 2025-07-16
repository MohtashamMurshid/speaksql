"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Settings,
  RefreshCw,
} from "lucide-react";

type DatabaseType = "postgresql" | "mysql" | "sqlite";

interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
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

interface DatabaseConnectorProps {
  onConnectionChange?: (
    connections: DatabaseConnection[],
    activeConnectionId: string | null
  ) => void;
}

export function DatabaseConnector({
  onConnectionChange,
}: DatabaseConnectorProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    null
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newConnection, setNewConnection] = useState<
    Partial<DatabaseConnection>
  >({
    name: "",
    type: "postgresql",
    config: {
      host: "localhost",
      port: 5432,
      database: "",
      username: "",
      password: "",
    },
  });

  const handleAddConnection = () => {
    if (!newConnection.name || !newConnection.type) return;

    const connection: DatabaseConnection = {
      id: crypto.randomUUID(),
      name: newConnection.name,
      type: newConnection.type,
      connected: false,
      config: newConnection.config || {},
    };

    const updatedConnections = [...connections, connection];
    setConnections(updatedConnections);
    onConnectionChange?.(updatedConnections, null); // No active connection on add

    // Reset form
    setNewConnection({
      name: "",
      type: "postgresql",
      config: {
        host: "localhost",
        port: 5432,
        database: "",
        username: "",
        password: "",
      },
    });
    setShowAddDialog(false);
  };

  const handleRemoveConnection = (id: string) => {
    const updatedConnections = connections.filter((conn) => conn.id !== id);
    setConnections(updatedConnections);
    onConnectionChange?.(updatedConnections, null); // No active connection on remove
  };

  // Persist connections and activeConnectionId
  useEffect(() => {
    localStorage.setItem("speaksql_connections", JSON.stringify(connections));
    localStorage.setItem(
      "speaksql_activeConnectionId",
      activeConnectionId || ""
    );
  }, [connections, activeConnectionId]);

  // Call onConnectionChange when connections or activeConnectionId changes
  useEffect(() => {
    onConnectionChange?.(connections, activeConnectionId);
  }, [connections, activeConnectionId]); // Removed onConnectionChange from deps to prevent infinite loop

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("speaksql_connections");
    if (saved) setConnections(JSON.parse(saved));
    const savedActive = localStorage.getItem("speaksql_activeConnectionId");
    if (savedActive) setActiveConnectionId(savedActive || null);
  }, []);

  // Set active connection when connecting
  const handleTestConnection = async (id: string) => {
    const connection = connections.find((conn) => conn.id === id);
    if (!connection) return;
    try {
      const res = await fetch("/api/database/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: connection.type,
          config: connection.config,
        }),
      });
      const data = await res.json();
      if (data.connected) {
        // Fetch schema
        const schemaRes = await fetch("/api/database/schema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: connection.type,
            config: connection.config,
          }),
        });
        const schemaData = await schemaRes.json();

        console.log("Fetched schema data:", schemaData);

        if (schemaData.error) {
          throw new Error(schemaData.error);
        }

        // Fetch sample data for better context
        let sampleData = null;
        try {
          const sampleRes = await fetch("/api/database/sample-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: connection.type,
              config: connection.config,
              tables: schemaData.schema.map(
                (table: { name: string }) => table.name
              ),
            }),
          });
          const sampleDataResult = await sampleRes.json();
          sampleData = sampleDataResult.sampleData;
        } catch (error) {
          console.warn("Failed to fetch sample data:", error);
        }

        setConnections((prev) =>
          prev.map((conn) =>
            conn.id === id
              ? {
                  ...conn,
                  connected: true,
                  error: undefined,
                  schema: schemaData.schema,
                  sampleData: sampleData,
                }
              : conn
          )
        );
        setActiveConnectionId(id);
      } else {
        setConnections((prev) =>
          prev.map((conn) =>
            conn.id === id
              ? {
                  ...conn,
                  connected: false,
                  error: data.error,
                  schema: undefined,
                  sampleData: undefined,
                }
              : conn
          )
        );
      }
    } catch (err) {
      console.error("Connection test failed:", err);
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === id
            ? {
                ...conn,
                connected: false,
                error: err instanceof Error ? err.message : "Connection failed",
                schema: undefined,
                sampleData: undefined,
              }
            : conn
        )
      );
    }
  };

  const refreshSchema = async (id: string) => {
    const connection = connections.find((conn) => conn.id === id);
    if (!connection || !connection.connected) return;

    try {
      // Fetch schema with cache busting
      const schemaRes = await fetch("/api/database/schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          type: connection.type,
          config: connection.config,
        }),
      });
      const schemaData = await schemaRes.json();

      console.log("Refreshed schema data:", schemaData);

      if (schemaData.error) {
        throw new Error(schemaData.error);
      }

      // Fetch sample data for better context
      let sampleData = null;
      try {
        const sampleRes = await fetch("/api/database/sample-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: connection.type,
            config: connection.config,
            tables: schemaData.schema.map(
              (table: { name: string }) => table.name
            ),
          }),
        });
        const sampleDataResult = await sampleRes.json();
        sampleData = sampleDataResult.sampleData;
      } catch (error) {
        console.warn("Failed to fetch sample data:", error);
      }

      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === id
            ? {
                ...conn,
                schema: schemaData.schema,
                sampleData: sampleData,
              }
            : conn
        )
      );
    } catch (err) {
      console.error("Schema refresh failed:", err);
    }
  };

  const getDefaultPort = (type: DatabaseType): number => {
    switch (type) {
      case "postgresql":
        return 5432;
      case "mysql":
        return 3306;
      case "sqlite":
        return 0;
      default:
        return 5432;
    }
  };

  const handleTypeChange = (type: DatabaseType) => {
    setNewConnection((prev) => ({
      ...prev,
      type,
      config: {
        ...prev.config,
        port: getDefaultPort(type),
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Database Connections
          </h3>
          <p className="text-sm text-muted-foreground">
            Connect to existing SQL databases (PostgreSQL, MySQL, SQLite)
          </p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Database Connection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Connection Name */}
              <div>
                <label className="text-sm font-medium">Connection Name</label>
                <input
                  type="text"
                  placeholder="My Database"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={newConnection.name || ""}
                  onChange={(e) =>
                    setNewConnection((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Database Type */}
              <div>
                <label className="text-sm font-medium">Database Type</label>
                <Select
                  value={newConnection.type}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="sqlite">SQLite File</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newConnection.type !== "sqlite" && (
                <>
                  {/* Host */}
                  <div>
                    <label className="text-sm font-medium">Host</label>
                    <input
                      type="text"
                      placeholder="localhost"
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                      value={newConnection.config?.host || ""}
                      onChange={(e) =>
                        setNewConnection((prev) => ({
                          ...prev,
                          config: { ...prev.config, host: e.target.value },
                        }))
                      }
                    />
                  </div>

                  {/* Port */}
                  <div>
                    <label className="text-sm font-medium">Port</label>
                    <input
                      type="number"
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                      value={
                        newConnection.config?.port ||
                        getDefaultPort(newConnection.type!)
                      }
                      onChange={(e) =>
                        setNewConnection((prev) => ({
                          ...prev,
                          config: {
                            ...prev.config,
                            port: parseInt(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>

                  {/* Database */}
                  <div>
                    <label className="text-sm font-medium">Database</label>
                    <input
                      type="text"
                      placeholder="database_name"
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                      value={newConnection.config?.database || ""}
                      onChange={(e) =>
                        setNewConnection((prev) => ({
                          ...prev,
                          config: { ...prev.config, database: e.target.value },
                        }))
                      }
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="text-sm font-medium">Username</label>
                    <input
                      type="text"
                      placeholder="username"
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                      value={newConnection.config?.username || ""}
                      onChange={(e) =>
                        setNewConnection((prev) => ({
                          ...prev,
                          config: { ...prev.config, username: e.target.value },
                        }))
                      }
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-sm font-medium">Password</label>
                    <input
                      type="password"
                      placeholder="password"
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                      value={newConnection.config?.password || ""}
                      onChange={(e) =>
                        setNewConnection((prev) => ({
                          ...prev,
                          config: { ...prev.config, password: e.target.value },
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {newConnection.type === "sqlite" && (
                <div>
                  <label className="text-sm font-medium">
                    SQLite File Path
                  </label>
                  <input
                    type="text"
                    placeholder="/path/to/database.sqlite"
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    value={newConnection.config?.filePath || ""}
                    onChange={(e) =>
                      setNewConnection((prev) => ({
                        ...prev,
                        config: { ...prev.config, filePath: e.target.value },
                      }))
                    }
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddConnection}
                  disabled={!newConnection.name}
                >
                  Add Connection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connections List */}
      {connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((connection) => (
            <Card key={connection.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent rounded-lg">
                      <Database className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{connection.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {connection.type.toUpperCase()}
                        </Badge>
                        {connection.connected ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {connection.type === "sqlite"
                          ? connection.config.filePath
                          : `${connection.config.host}:${connection.config.port}/${connection.config.database}`}
                      </p>
                      {connection.error && (
                        <p className="text-xs text-red-500 mt-1">
                          {connection.error}
                        </p>
                      )}
                      {connection.schema && connection.schema.length > 0 && (
                        <div className="mt-2 text-xs">
                          <strong>Tables:</strong>
                          <ul className="ml-2 list-disc">
                            {connection.schema.map(
                              (table: {
                                name: string;
                                columns: { name: string }[];
                              }) => (
                                <li key={table.name}>
                                  <span className="font-semibold">
                                    {table.name}
                                  </span>
                                  {table.columns &&
                                    table.columns.length > 0 && (
                                      <span>
                                        :{" "}
                                        {table.columns
                                          .map(
                                            (col: { name: string }) => col.name
                                          )
                                          .join(", ")}
                                      </span>
                                    )}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(connection.id)}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      {connection.connected ? "Disconnect" : "Connect"}
                    </Button>
                    {connection.connected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshSchema(connection.id)}
                        title="Refresh schema"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveConnection(connection.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h4 className="text-lg font-medium text-foreground mb-2">
              No Database Connections
            </h4>
            <p className="text-muted-foreground mb-4">
              Add a connection to your existing SQL database
            </p>
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Connection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
