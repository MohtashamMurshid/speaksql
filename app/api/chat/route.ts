import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";

interface TableColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

interface TableSchema {
  name: string;
  columns: TableColumn[];
}

interface DatabaseConnection {
  id: string;
  name: string;
  type: "postgresql" | "mysql" | "sqlite";
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

// Tool factory for executing SQL queries
function createExecuteQueryTool(activeConnection: DatabaseConnection | null) {
  return tool({
    description:
      "Execute a SQL query against the connected database and return the results. Use this when the user asks for data analysis, wants to run a query, or needs to see actual data from the database.",
    parameters: z.object({
      query: z.string().describe("The SQL query to execute"),
      explanation: z
        .string()
        .describe("Brief explanation of what this query does"),
    }),
    execute: async ({ query, explanation }) => {
      try {
        if (!activeConnection || !activeConnection.connected) {
          throw new Error("No active database connection available");
        }

        const response = await fetch(
          `${
            process.env.NEXTAUTH_URL || "http://localhost:3000"
          }/api/database/query`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: activeConnection.type,
              config: activeConnection.config,
              query: query,
            }),
          }
        );

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        return {
          success: true,
          explanation,
          columns: data.columns,
          rows: data.rows,
          rowCount: data.rowCount,
          executionTime: data.executionTime,
        };
      } catch (error) {
        return {
          success: false,
          explanation,
          error:
            error instanceof Error ? error.message : "Query execution failed",
        };
      }
    },
  });
}

// Helper function to generate SQL example queries based on schema
function generateExampleQueries(schema: TableSchema[]): string {
  if (schema.length === 0) return "No tables available.";

  const examples = [];

  // Basic SELECT examples
  schema.slice(0, 2).forEach((table) => {
    examples.push(`-- Get all records from ${table.name}
SELECT * FROM ${table.name} LIMIT 10;`);

    if (table.columns.length > 1) {
      const firstFewColumns = table.columns.slice(0, 3).map((col) => col.name);
      examples.push(`-- Get specific columns from ${table.name}
SELECT ${firstFewColumns.join(", ")} FROM ${table.name};`);
    }
  });

  // JOIN examples if there are foreign keys
  const tablesWithForeignKeys = schema.filter((table) =>
    table.columns.some((col) => col.foreignKey)
  );

  if (tablesWithForeignKeys.length > 0) {
    const table = tablesWithForeignKeys[0];
    const fkColumn = table.columns.find((col) => col.foreignKey);
    if (fkColumn?.foreignKey) {
      examples.push(`-- Join ${table.name} with ${fkColumn.foreignKey.table}
SELECT t1.*, t2.*
FROM ${table.name} t1
JOIN ${fkColumn.foreignKey.table} t2 ON t1.${fkColumn.name} = t2.${fkColumn.foreignKey.column};`);
    }
  }

  return examples.join("\n\n");
}

// Helper function to validate schema
function validateSchema(schema: unknown): schema is TableSchema[] {
  if (!Array.isArray(schema)) return false;

  return schema.every(
    (table) =>
      typeof table === "object" &&
      table !== null &&
      typeof table.name === "string" &&
      Array.isArray(table.columns) &&
      table.columns.every(
        (col: unknown) =>
          typeof col === "object" &&
          col !== null &&
          "name" in col &&
          "type" in col &&
          typeof (col as { name: unknown }).name === "string" &&
          typeof (col as { type: unknown }).type === "string"
      )
  );
}

export async function POST(req: Request) {
  try {
    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, schema, activeConnection } = body;

    // Validate messages
    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages must be an array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate schema
    if (!validateSchema(schema)) {
      return new Response(JSON.stringify({ error: "Invalid schema format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate schema description for the AI
    const schemaDescription =
      schema.length > 0
        ? schema
            .map((table) => {
              const columnDescriptions = table.columns
                .map((col) => {
                  let description = `${col.name} (${col.type})`;
                  if (col.primaryKey) description += " [PRIMARY KEY]";
                  if (col.foreignKey) {
                    description += ` [FOREIGN KEY -> ${col.foreignKey.table}.${col.foreignKey.column}]`;
                  }
                  return description;
                })
                .join(", ");

              return `Table: ${table.name}\n  Columns: ${columnDescriptions}`;
            })
            .join("\n\n")
        : "No database schema provided.";

    // Generate example queries
    const exampleQueries = generateExampleQueries(schema);

    // Generate sample data description
    const sampleDataDescription = activeConnection?.sampleData
      ? activeConnection.sampleData
          .map(
            (sample: {
              tableName: string;
              columns: string[];
              rows: string[][];
              totalRows: number;
            }) => {
              const sampleRows = sample.rows
                .map((row: string[]) => `  ${row.join(" | ")}`)
                .join("\n");
              return `Table: ${sample.tableName} (${
                sample.totalRows
              } total rows)
Columns: ${sample.columns.join(", ")}
Sample data:
${sampleRows}`;
            }
          )
          .join("\n\n")
      : "No sample data available.";

    // Create a comprehensive system message
    const systemMessage = `You are SpeakSQL, an expert database assistant that helps users interact with their database using natural language. You have deep knowledge of SQL, database design, and data analysis.

## Current Database Schema:
${schemaDescription}

## Sample Data:
${sampleDataDescription}

## Example Queries:
${exampleQueries}

## Your Capabilities:
1. **SQL Query Generation & Execution**: Generate and automatically execute SQL queries using the execute_query tool
2. **Data Analysis**: Help analyze data patterns, relationships, and insights
3. **Schema Understanding**: Explain table relationships, data types, and constraints
4. **Query Optimization**: Suggest performance improvements and best practices
5. **Data Validation**: Help with data quality checks and validation queries
6. **Reporting**: Create queries for reports, dashboards, and analytics

## Tool Usage Guidelines:
- **Use execute_query tool when**: User asks for data analysis, wants to see actual data, needs query results, or requests information that requires running a query
- **Don't use tools when**: User asks for general help, schema explanations, or theoretical SQL questions
- **Always explain** what you're about to query before executing it

## Response Guidelines:
- When executing queries, provide context about what you're searching for
- Format SQL queries in code blocks with \`\`\`sql when showing them for reference
- Ensure queries are compatible with the provided schema
- Use proper SQL syntax and best practices
- Explain complex queries in simple terms
- Be educational and explain the "why" behind your recommendations
- Handle edge cases and provide error-resistant queries

## Response Format for Query Execution:
1. Brief explanation of what you'll query and why
2. Execute the query using the tool
3. Interpret and explain the results
4. Provide insights or follow-up suggestions

Remember: You're not just generating queries, you're teaching users to understand their data better while providing real insights from their actual data.`;

    // Setup parameters for streamText
    const baseParams = {
      model: openai("gpt-4o-mini"),
      system: systemMessage,
      messages: messages as Parameters<typeof streamText>[0]["messages"], // Type assertion for AI SDK compatibility
      temperature: 0.3, // Lower temperature for more consistent SQL generation
      maxTokens: 2000, // Increased for more detailed responses
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
      maxSteps: 10,
    };

    // Call OpenAI with improved configuration
    const result =
      activeConnection && activeConnection.connected
        ? await streamText({
            ...baseParams,
            tools: {
              execute_query: createExecuteQueryTool(activeConnection),
            },
          })
        : await streamText(baseParams);

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);

    // Enhanced error logging
    const errorDetails = {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    };

    console.error("Detailed error:", errorDetails);

    // Return more specific error responses
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key configuration issue" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      if (error.message.includes("rate limit")) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Internal server error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
