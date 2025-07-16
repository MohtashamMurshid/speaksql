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

export interface SampleData {
  tableName: string;
  columns: string[];
  rows: string[][];
  totalRows: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, config, tables } = body as {
      type: string;
      config: DatabaseConfig;
      tables: string[];
    };

    let sampleData: SampleData[];

    switch (type) {
      case "postgresql":
        sampleData = await getPostgresSampleData(config, tables);
        break;

      case "mysql":
        sampleData = await getMysqlSampleData(config, tables);
        break;

      case "sqlite":
        sampleData = await getSqliteSampleData(config, tables);
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported database type" },
          { status: 400 }
        );
    }

    return NextResponse.json({ sampleData });
  } catch (error) {
    console.error("Sample data retrieval failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sample data retrieval failed",
      },
      { status: 500 }
    );
  }
}

async function getPostgresSampleData(
  config: DatabaseConfig,
  tables: string[]
): Promise<SampleData[]> {
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
    const sampleData: SampleData[] = [];

    for (const tableName of tables) {
      // Get sample rows
      const sampleResult = await client.query(
        `SELECT * FROM "${tableName}" LIMIT 3`
      );

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM "${tableName}"`
      );
      const totalRows = parseInt(countResult.rows[0].total);

      const columns = sampleResult.fields.map((field) => field.name);
      const rows = sampleResult.rows.map((row) =>
        columns.map((col) => (row[col] !== null ? String(row[col]) : "NULL"))
      );

      sampleData.push({
        tableName,
        columns,
        rows,
        totalRows,
      });
    }

    return sampleData;
  } finally {
    await client.end();
  }
}

async function getMysqlSampleData(
  config: DatabaseConfig,
  tables: string[]
): Promise<SampleData[]> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectTimeout: 10000,
  });

  try {
    const sampleData: SampleData[] = [];

    for (const tableName of tables) {
      // Get sample rows
      const [sampleRows, fields] = await connection.execute(
        `SELECT * FROM \`${tableName}\` LIMIT 3`
      );

      // Get total count
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM \`${tableName}\``
      );
      const totalRows =
        Array.isArray(countRows) && countRows.length > 0
          ? parseInt(String((countRows[0] as Record<string, unknown>).total))
          : 0;

      const columns = Array.isArray(fields)
        ? fields.map((field) => (field as { name: string }).name)
        : [];

      const rows = Array.isArray(sampleRows)
        ? (sampleRows as Record<string, unknown>[]).map((row) =>
            columns.map((col) =>
              row[col] !== null && row[col] !== undefined
                ? String(row[col])
                : "NULL"
            )
          )
        : [];

      sampleData.push({
        tableName,
        columns,
        rows,
        totalRows,
      });
    }

    return sampleData;
  } finally {
    await connection.end();
  }
}

async function getSqliteSampleData(
  config: DatabaseConfig,
  tables: string[]
): Promise<SampleData[]> {
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

    const sampleData: SampleData[] = [];
    let tablesProcessed = 0;

    if (tables.length === 0) {
      db.close();
      resolve(sampleData);
      return;
    }

    for (const tableName of tables) {
      // Get sample rows
      db.all(`SELECT * FROM "${tableName}" LIMIT 3`, [], (err, sampleRows) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }

        // Get total count
        db.get(
          `SELECT COUNT(*) as total FROM "${tableName}"`,
          [],
          (err, countRow) => {
            if (err) {
              db.close();
              reject(err);
              return;
            }

            const totalRows = countRow
              ? parseInt(String((countRow as Record<string, unknown>).total))
              : 0;

            let columns: string[] = [];
            let rows: string[][] = [];

            if (Array.isArray(sampleRows) && sampleRows.length > 0) {
              columns = Object.keys(sampleRows[0] as Record<string, unknown>);
              rows = (sampleRows as Record<string, unknown>[]).map((row) =>
                columns.map((col) =>
                  row[col] !== null && row[col] !== undefined
                    ? String(row[col])
                    : "NULL"
                )
              );
            }

            sampleData.push({
              tableName,
              columns,
              rows,
              totalRows,
            });

            tablesProcessed++;
            if (tablesProcessed === tables.length) {
              db.close();
              resolve(sampleData);
            }
          }
        );
      });
    }
  });
}
