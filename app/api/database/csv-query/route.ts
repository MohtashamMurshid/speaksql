import { NextRequest, NextResponse } from "next/server";

interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTime: number;
}

interface CSVTable {
  name: string;
  columns: Array<{
    name: string;
    type: string;
  }>;
  data: string[][];
}

// Simple in-memory SQL-like query engine for CSV data
class CSVQueryEngine {
  private tables: Map<string, CSVTable> = new Map();

  loadTable(table: CSVTable) {
    this.tables.set(table.name.toLowerCase(), table);
  }

  executeQuery(query: string): QueryResult {
    const normalizedQuery = query.trim().toLowerCase();

    // Simple SELECT parser (handles basic SELECT statements)
    if (normalizedQuery.startsWith("select")) {
      return this.executeSelect(query);
    }

    throw new Error(
      "Only SELECT statements are currently supported for CSV queries"
    );
  }

  private executeSelect(query: string): QueryResult {
    const normalizedQuery = query.toLowerCase();

    // Extract table name from FROM clause
    const fromMatch = normalizedQuery.match(/from\s+(\w+)/);
    if (!fromMatch) {
      throw new Error("Invalid query: missing FROM clause");
    }

    const tableName = fromMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' not found`);
    }

    // For now, return all data (can be enhanced to support WHERE, ORDER BY, etc.)
    const columns = table.columns.map((col) => col.name);
    let rows = table.data;

    // Simple WHERE clause support
    const whereMatch = normalizedQuery.match(
      /where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/
    );
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      rows = this.applyWhereClause(rows, columns, whereClause);
    }

    // Simple LIMIT support
    const limitMatch = normalizedQuery.match(/limit\s+(\d+)/);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      rows = rows.slice(0, limit);
    }

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTime: 0, // Will be set by caller
    };
  }

  private applyWhereClause(
    rows: string[][],
    columns: string[],
    whereClause: string
  ): string[][] {
    // Very basic WHERE clause support - can be enhanced
    const conditionMatch = whereClause.match(
      /(\w+)\s*(=|!=|>|<|>=|<=)\s*'?([^']+)'?/
    );
    if (!conditionMatch) {
      return rows; // Return all rows if we can't parse the condition
    }

    const [, columnName, operator, value] = conditionMatch;
    const columnIndex = columns.findIndex(
      (col) => col.toLowerCase() === columnName.toLowerCase()
    );

    if (columnIndex === -1) {
      throw new Error(`Column '${columnName}' not found`);
    }

    return rows.filter((row) => {
      const cellValue = row[columnIndex] || "";
      switch (operator) {
        case "=":
          return cellValue.toLowerCase() === value.toLowerCase();
        case "!=":
          return cellValue.toLowerCase() !== value.toLowerCase();
        case ">":
          return parseFloat(cellValue) > parseFloat(value);
        case "<":
          return parseFloat(cellValue) < parseFloat(value);
        case ">=":
          return parseFloat(cellValue) >= parseFloat(value);
        case "<=":
          return parseFloat(cellValue) <= parseFloat(value);
        default:
          return true;
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, tables } = body as {
      query: string;
      tables?: CSVTable[];
    };

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Create a new query engine instance
    const queryEngine = new CSVQueryEngine();

    // Load tables if provided
    if (tables && Array.isArray(tables)) {
      tables.forEach((table) => queryEngine.loadTable(table));
    }

    // Execute the query
    const result = queryEngine.executeQuery(query);
    result.executionTime = Date.now() - startTime;

    return NextResponse.json(result);
  } catch (error) {
    console.error("CSV query execution failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "CSV query execution failed",
      },
      { status: 500 }
    );
  }
}
