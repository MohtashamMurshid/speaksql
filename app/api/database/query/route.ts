import { NextRequest, NextResponse } from "next/server";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filePath?: string;
}

export interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTime: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, config, query } = body as {
      type: string;
      config: DatabaseConfig;
      query: string;
    };

    const startTime = Date.now();
    let result: QueryResult;

    switch (type) {
      case "postgresql":
        result = await executePostgresQuery(config, query, startTime);
        break;

      case "mysql":
        result = await executeMysqlQuery(config, query, startTime);
        break;

      case "sqlite":
        result = await executeSqliteQuery(config, query, startTime);
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported database type" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Query execution failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Query execution failed",
      },
      { status: 500 }
    );
  }
}

async function executePostgresQuery(
  config: DatabaseConfig,
  query: string,
  startTime: number
): Promise<QueryResult> {
  const client = new PgClient({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    const result = await client.query(query);
    const executionTime = Date.now() - startTime;

    const columns = result.fields.map((field) => field.name);
    const rows = result.rows.map((row) =>
      columns.map((col) => (row[col] !== null ? String(row[col]) : ""))
    );

    return {
      columns,
      rows,
      rowCount: result.rowCount || 0,
      executionTime,
    };
  } finally {
    await client.end();
  }
}

async function executeMysqlQuery(
  config: DatabaseConfig,
  query: string,
  startTime: number
): Promise<QueryResult> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectTimeout: 10000,
  });
  try {
    const [rows, fields] = await connection.execute(query);
    const executionTime = Date.now() - startTime;
    const columns = Array.isArray(fields)
      ? fields.map((field) => (field as { name: string }).name)
      : [];
    const resultRows = Array.isArray(rows)
      ? (rows as Record<string, unknown>[]).map((row) =>
          columns.map((col) =>
            row[col] !== null && row[col] !== undefined ? String(row[col]) : ""
          )
        )
      : [];
    return {
      columns,
      rows: resultRows,
      rowCount: resultRows.length,
      executionTime,
    };
  } finally {
    await connection.end();
  }
}

async function executeSqliteQuery(
  config: DatabaseConfig,
  query: string,
  startTime: number
): Promise<QueryResult> {
  return new Promise((resolve, reject) => {
    if (!config.filePath || typeof config.filePath !== "string") {
      reject(new Error("SQLite file path is required and must be a string"));
      return;
    }
    const db = new sqlite3.Database(config.filePath, (err) => {
      if (err) {
        reject(err);
        return;
      }
    });

    db.all(query, [], (err, rows) => {
      const executionTime = Date.now() - startTime;
      if (err) {
        db.close();
        reject(err);
        return;
      }
      let columns: string[] = [];
      let resultRows: string[][] = [];
      if (Array.isArray(rows) && rows.length > 0) {
        columns = Object.keys(rows[0] as Record<string, unknown>);
        resultRows = (rows as Record<string, unknown>[]).map((row) =>
          columns.map((col) =>
            row[col] !== null && row[col] !== undefined ? String(row[col]) : ""
          )
        );
      }
      db.close();
      resolve({
        columns,
        rows: resultRows,
        rowCount: Array.isArray(rows) ? rows.length : 0,
        executionTime,
      });
    });
  });
}
