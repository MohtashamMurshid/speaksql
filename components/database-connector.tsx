"use client";

import { useState } from "react";
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
}

interface DatabaseConnectorProps {
  onConnectionChange?: (connections: DatabaseConnection[]) => void;
}

export function DatabaseConnector({
  onConnectionChange,
}: DatabaseConnectorProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
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
    onConnectionChange?.(updatedConnections);

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
    onConnectionChange?.(updatedConnections);
  };

  const handleTestConnection = async (id: string) => {
    // Simulate connection test
    setConnections((prev) =>
      prev.map((conn) =>
        conn.id === id ? { ...conn, connected: !conn.connected } : conn
      )
    );
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

      {/* Info Note */}
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <CardContent className="p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Database connections require a backend API to
            be implemented. Currently, only CSV imports work fully. External
            database support coming soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
