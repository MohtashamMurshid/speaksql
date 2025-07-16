"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Download, RefreshCw, Database } from "lucide-react";
import dagre from "dagre";

import "@xyflow/react/dist/style.css";

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

interface TableColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

interface TableNodeData {
  tableName: string;
  columns: TableColumn[];
}

interface SchemaVisualizerProps {
  schema: TableSchema[];
  onSchemaChange?: (schema: TableSchema[]) => void;
}

// Custom Table Node Component
function TableNode({ data }: { data: TableNodeData }) {
  return (
    <Card className="min-w-[250px] shadow-lg border-2 border-primary/20">
      <CardHeader className="pb-2 bg-accent">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-primary">{data.tableName}</h3>
          <Badge variant="secondary" className="text-xs">
            {data.columns.length} cols
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-1">
          {data.columns.map((column: TableColumn, index: number) => (
            <div
              key={column.name}
              className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{column.name}</span>
                {column.primaryKey && (
                  <Badge variant="default" className="text-xs px-1 py-0">
                    PK
                  </Badge>
                )}
                {column.foreignKey && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    FK
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {column.type}
              </span>

              {/* Handles for connections */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${data.tableName}-${column.name}-target`}
                className="w-2 h-2"
                style={{ top: `${50 + index * 20}px` }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={`${data.tableName}-${column.name}-source`}
                className="w-2 h-2"
                style={{ top: `${50 + index * 20}px` }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const nodeTypes = {
  tableNode: TableNode,
};

export function SchemaVisualizer({
  schema,
  onSchemaChange,
}: SchemaVisualizerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Check if we have an active database connection
  const [connectionInfo, setConnectionInfo] = useState<{
    name: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    const activeConnectionId = localStorage.getItem(
      "speaksql_activeConnectionId"
    );
    const connectionsStr = localStorage.getItem("speaksql_connections");

    if (activeConnectionId && connectionsStr) {
      try {
        const connections = JSON.parse(connectionsStr);
        const activeConn = connections.find(
          (conn: {
            id: string;
            connected: boolean;
            name: string;
            type: string;
          }) => conn.id === activeConnectionId && conn.connected
        );
        if (activeConn) {
          setConnectionInfo({ name: activeConn.name, type: activeConn.type });
        } else {
          setConnectionInfo(null);
        }
      } catch {
        setConnectionInfo(null);
      }
    } else {
      setConnectionInfo(null);
    }
  }, [schema]);

  // Layout algorithm using Dagre
  const getLayoutedElements = useCallback((nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: "LR", nodesep: 100, ranksep: 150 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 250, height: 200 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.targetPosition = Position.Left;
      node.sourcePosition = Position.Right;
      node.position = {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 100,
      };
    });

    return { nodes, edges };
  }, []);

  // Convert schema to nodes and edges
  useEffect(() => {
    if (schema.length === 0) return;

    // Log the onSchemaChange prop to satisfy linter (component doesn't modify schema)
    console.log(
      "Schema visualizer loaded with schema change handler:",
      !!onSchemaChange
    );

    const schemaNodes: Node[] = schema.map((table, index) => ({
      id: table.name,
      type: "tableNode",
      position: { x: index * 300, y: 0 },
      data: {
        tableName: table.name,
        columns: table.columns,
      },
    }));

    const newEdges: Edge[] = [];

    // Create edges for foreign key relationships
    schema.forEach((table) => {
      table.columns.forEach((column) => {
        if (column.foreignKey) {
          newEdges.push({
            id: `${table.name}-${column.name}-${column.foreignKey.table}`,
            source: table.name,
            target: column.foreignKey.table,
            sourceHandle: `${table.name}-${column.name}-source`,
            targetHandle: `${column.foreignKey.table}-${column.foreignKey.column}-target`,
            type: "smoothstep",
            animated: true,
            style: {
              stroke: "hsl(var(--primary))",
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "hsl(var(--primary))",
            },
            label: `${column.name} → ${column.foreignKey.column}`,
            labelStyle: { fontSize: 12, fontWeight: "bold" },
            labelBgStyle: {
              fill: "hsl(var(--background))",
              fillOpacity: 0.8,
            },
          });
        }
      });
    });

    const layouted = getLayoutedElements(schemaNodes, newEdges);
    setNodes(layouted.nodes as Node[]);
    setEdges(layouted.edges);
  }, [schema, getLayoutedElements, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const relayoutNodes = () => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  };

  const downloadSchema = () => {
    const dataStr = JSON.stringify(schema, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = "database-schema.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="h-[600px] relative">
      {/* Header Controls */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {connectionInfo && (
          <div className="mr-4 px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium">
            {connectionInfo.name} ({connectionInfo.type.toUpperCase()})
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMiniMap(!showMiniMap)}
        >
          {showMiniMap ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
          {showMiniMap ? "Hide" : "Show"} MiniMap
        </Button>
        <Button variant="outline" size="sm" onClick={relayoutNodes}>
          <RefreshCw className="w-4 h-4" />
          Re-layout
        </Button>
        <Button variant="outline" size="sm" onClick={downloadSchema}>
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* React Flow */}
      {schema.length > 0 ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Controls position="bottom-right" />
          <Background color="hsl(var(--muted-foreground))" gap={16} />
          {showMiniMap && (
            <MiniMap
              position="bottom-left"
              style={{
                height: 120,
                width: 200,
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              zoomable
              pannable
            />
          )}
        </ReactFlow>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Database className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium text-foreground mb-2">
              No Schema Available
            </h3>
            <p className="text-muted-foreground mb-4">
              {connectionInfo
                ? `Connect to ${connectionInfo.name} and ensure it has tables, or import CSV files to visualize data schema.`
                : "Connect to a database or import CSV files to visualize data schema."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
