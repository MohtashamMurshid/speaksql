import { NextRequest, NextResponse } from "next/server";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import sqlite3 from "sqlite3";
import { promisify } from "util";

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filePath?: string;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: "postgresql" | "mysql" | "sqlite";
  config: DatabaseConfig;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, config } = body as { type: string; config: DatabaseConfig };

    let isConnected = false;
    let error = null;

    switch (type) {
      case "postgresql":
        try {
          const client = new PgClient({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.username,
            password: config.password,
            connectionTimeoutMillis: 5000,
          });

          await client.connect();
          await client.query("SELECT 1");
          await client.end();
          isConnected = true;
        } catch (err) {
          error = err instanceof Error ? err.message : "Connection failed";
        }
        break;

      case "mysql":
        try {
          const connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.username,
            password: config.password,
            connectTimeout: 5000,
          });

          await connection.execute("SELECT 1");
          await connection.end();
          isConnected = true;
        } catch (err) {
          error = err instanceof Error ? err.message : "Connection failed";
        }
        break;

      case "sqlite":
        try {
          if (!config.filePath || typeof config.filePath !== "string") {
            throw new Error(
              "SQLite file path is required and must be a string"
            );
          }
          const db = new sqlite3.Database(config.filePath);
          const dbRun = promisify(db.run.bind(db));

          await dbRun("SELECT 1");
          db.close();
          isConnected = true;
        } catch (err) {
          error = err instanceof Error ? err.message : "Connection failed";
        }
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported database type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      connected: isConnected,
      error,
    });
  } catch (error) {
    console.error("Database connection test failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
