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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, config } = body as { type: string; config: DatabaseConfig };

    let schema: TableSchema[];

    switch (type) {
      case "postgresql":
        schema = await getPostgresSchema(config);
        break;

      case "mysql":
        schema = await getMysqlSchema(config);
        break;

      case "sqlite":
        schema = await getSqliteSchema(config);
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported database type" },
          { status: 400 }
        );
    }

    return NextResponse.json({ schema });
  } catch (error) {
    console.error("Schema retrieval failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Schema retrieval failed",
      },
      { status: 500 }
    );
  }
}

async function getPostgresSchema(
  config: DatabaseConfig
): Promise<TableSchema[]> {
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

    // Get all tables in the public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const schema: TableSchema[] = [];

    console.log(
      `Found ${tablesResult.rows.length} tables:`,
      tablesResult.rows.map((t) => t.table_name)
    );

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;

      try {
        // Get columns for this table
        const columnsResult = await client.query(
          `
          SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
            fk.foreign_table_name,
            fk.foreign_column_name
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.table_name, ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
          ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
          LEFT JOIN (
            SELECT 
              ku.table_name,
              ku.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
          ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
          WHERE c.table_name = $1 AND c.table_schema = 'public'
          ORDER BY c.ordinal_position
        `,
          [tableName]
        );

        console.log(
          `Table ${tableName} has ${columnsResult.rows.length} columns:`,
          columnsResult.rows.map((c) => c.column_name)
        );

        const columns = columnsResult.rows.map((col) => ({
          name: col.column_name,
          type: col.data_type.toUpperCase(),
          primaryKey: col.is_primary_key,
          foreignKey: col.foreign_table_name
            ? {
                table: col.foreign_table_name,
                column: col.foreign_column_name,
              }
            : undefined,
        }));

        schema.push({ name: tableName, columns });
      } catch (error) {
        console.error(`Error fetching columns for table ${tableName}:`, error);
        // Still add the table even if we can't get columns
        schema.push({ name: tableName, columns: [] });
      }
    }

    return schema;
  } finally {
    await client.end();
  }
}

async function getMysqlSchema(config: DatabaseConfig): Promise<TableSchema[]> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectTimeout: 10000,
  });
  try {
    // Get all tables
    const [tables] = await connection.execute("SHOW TABLES");
    const tableNames = Array.isArray(tables)
      ? (tables as Record<string, unknown>[]).map(
          (row) => Object.values(row)[0] as string
        )
      : [];
    const schema: TableSchema[] = [];
    for (const tableName of tableNames) {
      // Get columns for this table
      const [columns] = await connection.execute(`DESCRIBE \`${tableName}\``);
      const tableColumns = Array.isArray(columns)
        ? (columns as Record<string, unknown>[]).map((col) => ({
            name: String(col.Field),
            type: String(col.Type).toUpperCase(),
            primaryKey: col.Key === "PRI",
          }))
        : [];
      schema.push({ name: tableName, columns: tableColumns });
    }
    return schema;
  } finally {
    await connection.end();
  }
}

async function getSqliteSchema(config: DatabaseConfig): Promise<TableSchema[]> {
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
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      [],
      (err, tables) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        const schema: TableSchema[] = [];
        let tablesProcessed = 0;
        const tableList = Array.isArray(tables)
          ? (tables as Record<string, unknown>[])
          : [];
        if (tableList.length === 0) {
          db.close();
          resolve(schema);
          return;
        }
        for (const table of tableList) {
          const tableName = String(table.name);
          db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
            if (err) {
              db.close();
              reject(err);
              return;
            }
            const tableColumns = Array.isArray(columns)
              ? (columns as Record<string, unknown>[]).map((col) => ({
                  name: String(col.name),
                  type: String(col.type).toUpperCase(),
                  primaryKey: col.pk === 1,
                }))
              : [];
            schema.push({ name: tableName, columns: tableColumns });
            tablesProcessed++;
            if (tablesProcessed === tableList.length) {
              db.close();
              resolve(schema);
            }
          });
        }
      }
    );
  });
}
