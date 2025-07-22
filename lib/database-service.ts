// Lightweight in-memory database service for CSV imports and SQL connections
export type DatabaseType = "csv" | "postgresql" | "mysql" | "sqlite";

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  connected: boolean;
  config?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    filePath?: string;
  };
}

export interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTime: number;
}

export interface TableSchema {
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

// In-memory table structure
interface Table {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    primaryKey?: boolean;
  }>;
  rows: string[][];
}

// Simple SQL parser for basic queries
class SimpleQueryEngine {
  private tables: Map<string, Table> = new Map();

  createTable(
    name: string,
    columns: Array<{ name: string; type: string }>,
    data: string[][]
  ): void {
    const table: Table = {
      name,
      columns: columns.map((col, index) => ({
        name: col.name,
        type: col.type,
        primaryKey: index === 0 && col.name.toLowerCase().includes("id"),
      })),
      rows: data,
    };
    this.tables.set(name, table);
  }

  dropTable(name: string): void {
    this.tables.delete(name);
  }

  getTables(): string[] {
    return Array.from(this.tables.keys());
  }

  getTableInfo(name: string): Table | undefined {
    return this.tables.get(name);
  }

  executeQuery(sql: string): { columns: string[]; rows: string[][] } {
    const trimmedSql = sql.trim().toLowerCase();

    // Handle SELECT queries
    if (trimmedSql.startsWith("select")) {
      return this.executeSelect(sql);
    }

    // Handle PRAGMA queries (for schema info)
    if (trimmedSql.startsWith("pragma")) {
      return this.executePragma(sql);
    }

    // Handle show tables
    if (
      trimmedSql.includes("show tables") ||
      trimmedSql.includes("sqlite_master")
    ) {
      return {
        columns: ["name"],
        rows: this.getTables().map((name) => [name]),
      };
    }

    throw new Error("Query type not supported yet");
  }

  private executeSelect(sql: string): { columns: string[]; rows: string[][] } {
    // Simple SELECT parser - supports basic queries
    const trimmedSql = sql.trim();

    // Extract table name
    const fromMatch = trimmedSql.match(/from\s+([`"']?)(\w+)\1/i);
    if (!fromMatch) {
      throw new Error("Could not parse table name from query");
    }

    const tableName = fromMatch[2];
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist`);
    }

    // Extract columns
    const selectMatch = trimmedSql.match(/select\s+(.*?)\s+from/i);
    if (!selectMatch) {
      throw new Error("Could not parse SELECT clause");
    }

    const selectClause = selectMatch[1].trim();
    let selectedColumns: string[];
    let resultRows = table.rows;

    if (selectClause === "*") {
      selectedColumns = table.columns.map((col) => col.name);
    } else {
      selectedColumns = selectClause
        .split(",")
        .map((col) => col.trim().replace(/[`"']/g, ""));
    }

    // WHERE clause support can be added later
    // For now, return all rows

    // Apply LIMIT if present
    const limitMatch = trimmedSql.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      resultRows = resultRows.slice(0, limit);
    }

    // Project selected columns
    const columnIndices = selectedColumns.map((colName) => {
      const index = table.columns.findIndex((col) => col.name === colName);
      if (index === -1) {
        throw new Error(
          `Column '${colName}' does not exist in table '${tableName}'`
        );
      }
      return index;
    });

    const projectedRows = resultRows.map((row) =>
      columnIndices.map((index) => row[index] || "")
    );

    return {
      columns: selectedColumns,
      rows: projectedRows,
    };
  }

  private executePragma(sql: string): { columns: string[]; rows: string[][] } {
    const tableMatch = sql.match(
      /pragma\s+table_info\s*\(\s*[`"']?(\w+)[`"']?\s*\)/i
    );
    if (!tableMatch) {
      throw new Error("Could not parse PRAGMA statement");
    }

    const tableName = tableMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      return { columns: [], rows: [] };
    }

    return {
      columns: ["cid", "name", "type", "notnull", "dflt_value", "pk"],
      rows: table.columns.map((col, index) => [
        index.toString(),
        col.name,
        col.type,
        "0",
        "",
        col.primaryKey ? "1" : "0",
      ]),
    };
  }
}

class DatabaseService {
  private connections: Map<string, DatabaseConnection> = new Map();
  private activeConnection: string | null = null;
  private queryEngine: SimpleQueryEngine = new SimpleQueryEngine();

  // Connection Management
  async addConnection(
    connection: Omit<DatabaseConnection, "id" | "connected">
  ): Promise<string> {
    const id = crypto.randomUUID();
    const newConnection: DatabaseConnection = {
      ...connection,
      id,
      connected: false,
    };

    this.connections.set(id, newConnection);
    return id;
  }

  async setActiveConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error("Connection not found");

    this.activeConnection = connectionId;
    connection.connected = true;
    this.connections.set(connectionId, connection);
  }

  getActiveConnection(): DatabaseConnection | null {
    if (!this.activeConnection) return null;
    return this.connections.get(this.activeConnection) || null;
  }

  getAllConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  // CSV Operations
  async initializeCsvDatabase(): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        // Only initialize if we don't have a CSV connection yet
        // Don't auto-create or activate connection until CSV data is imported
        const csvConnections = Array.from(this.connections.values()).filter(
          (c) => c.type === "csv"
        );

        // If we have a CSV connection but no schema, disconnect it
        if (csvConnections.length > 0) {
          const schema = await this.getSchema();
          if (schema.length === 0) {
            // Disconnect CSV connections that have no data
            csvConnections.forEach((conn) => {
              conn.connected = false;
              this.connections.set(conn.id, conn);
            });
            this.activeConnection = null;
          }
        }
      } catch (error) {
        console.error("Failed to initialize database:", error);
        throw error;
      }
    }
  }

  async importCsvData(
    fileName: string,
    tableName: string,
    csvData: string[][]
  ): Promise<void> {
    if (csvData.length === 0) return;

    const headers = csvData[0];
    const rows = csvData.slice(1);

    // Drop table if it exists
    this.queryEngine.dropTable(tableName);

    // Detect column types
    const columns = headers.map((header) => ({
      name: header.trim(),
      type: this.detectColumnType(
        rows.map((row) => row[headers.indexOf(header)] || "")
      ),
    }));

    // Create table with data
    this.queryEngine.createTable(tableName, columns, rows);

    // Ensure we have a CSV connection and activate it
    await this.ensureCsvConnection();
  }

  private async ensureCsvConnection(): Promise<void> {
    // Check if we have a CSV connection
    let csvConnection = Array.from(this.connections.values()).find(
      (c) => c.type === "csv"
    );

    // Create one if it doesn't exist
    if (!csvConnection) {
      const csvId = await this.addConnection({
        name: "CSV Data",
        type: "csv",
      });
      csvConnection = this.connections.get(csvId);
    }

    // Activate the CSV connection
    if (csvConnection) {
      await this.setActiveConnection(csvConnection.id);
    }
  }

  private detectColumnType(values: string[]): string {
    const nonEmptyValues = values
      .filter((v) => v && v.trim() !== "")
      .slice(0, 100);

    if (nonEmptyValues.length === 0) return "TEXT";

    // Check for integers
    if (nonEmptyValues.every((v) => /^\d+$/.test(v.trim()))) {
      return "INTEGER";
    }

    // Check for decimals
    if (nonEmptyValues.every((v) => /^\d*\.?\d+$/.test(v.trim()))) {
      return "REAL";
    }

    // Check for dates
    if (nonEmptyValues.every((v) => !isNaN(Date.parse(v)))) {
      return "DATETIME";
    }

    return "TEXT";
  }

  async getSchema(): Promise<TableSchema[]> {
    const connection = this.getActiveConnection();
    if (!connection) return [];

    if (connection.type === "csv") {
      return this.getCsvSchema();
    } else {
      throw new Error(
        `${connection.type} connections require backend implementation`
      );
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    const connection = this.getActiveConnection();
    if (!connection) throw new Error("No active connection");

    const startTime = Date.now();

    if (connection.type === "csv") {
      return this.executeCsvQuery(query, startTime);
    } else {
      throw new Error(
        `${connection.type} connections require backend implementation`
      );
    }
  }

  private getCsvSchema(): TableSchema[] {
    const tableNames = this.queryEngine.getTables();
    const schema: TableSchema[] = [];

    for (const tableName of tableNames) {
      const table = this.queryEngine.getTableInfo(tableName);
      if (table) {
        schema.push({
          name: tableName,
          columns: table.columns.map((col) => ({
            name: col.name,
            type: col.type,
            primaryKey: col.primaryKey,
          })),
        });
      }
    }

    return schema;
  }

  private executeCsvQuery(query: string, startTime: number): QueryResult {
    try {
      const result = this.queryEngine.executeQuery(query);
      const executionTime = Date.now() - startTime;

      return {
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rows.length,
        executionTime,
      };
    } catch (error) {
      throw new Error(
        `Query execution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
