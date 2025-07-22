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
  type: "postgresql" | "mysql" | "sqlite" | "csv";
  connected: boolean;
  config?: {
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
function createExecuteQueryTool(
  activeConnection: DatabaseConnection | null,
  schema: TableSchema[]
) {
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
        let data;

        // Handle CSV queries (either with CSV connection or when we have schema but no connection)
        if (
          (activeConnection && activeConnection.type === "csv") ||
          (!activeConnection && schema.length > 0)
        ) {
          // Prepare CSV tables data
          let tables: Array<{
            name: string;
            columns: Array<{ name: string; type: string }>;
            data: string[][];
          }> = [];

          if (activeConnection?.sampleData) {
            // Convert sampleData to the format expected by CSV query endpoint
            tables = activeConnection.sampleData.map((sampleTable) => ({
              name: sampleTable.tableName,
              columns: sampleTable.columns.map((colName) => ({
                name: colName,
                type: "VARCHAR(255)", // Default type, could be enhanced
              })),
              data: sampleTable.rows,
            }));
          } else if (schema.length > 0) {
            // If we have schema but no connection, create empty tables
            tables = schema.map((schemaTable) => ({
              name: schemaTable.name,
              columns: schemaTable.columns.map((col) => ({
                name: col.name,
                type: col.type || "VARCHAR(255)",
              })),
              data: [], // Empty data
            }));
          }

          // For CSV connections, we need to use a different approach since we can't import databaseService in the API route
          // We'll make a special request to a CSV query endpoint
          const response = await fetch(
            `${
              process.env.VERCEL_URL || "http://localhost:3000"
            }/api/database/csv-query`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: query,
                tables: tables,
              }),
            }
          );

          data = await response.json();
        } else if (activeConnection) {
          // For SQL databases, use the existing API
          const response = await fetch(
            `${
              process.env.VERCEL_URL || "http://localhost:3000"
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

          data = await response.json();
        } else {
          throw new Error("No active database connection available");
        }

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

  // Basic SELECT examples for first 2-3 tables
  schema.slice(0, 3).forEach((table) => {
    examples.push(`-- Get all records from ${table.name}
SELECT * FROM ${table.name} LIMIT 10;`);

    if (table.columns.length > 1) {
      const firstFewColumns = table.columns.slice(0, 3).map((col) => col.name);
      examples.push(`-- Get specific columns from ${table.name}
SELECT ${firstFewColumns.join(", ")} FROM ${table.name};`);
    }

    // Add column-specific examples
    const numericColumns = table.columns.filter(
      (col) =>
        col.type.toLowerCase().includes("int") ||
        col.type.toLowerCase().includes("decimal") ||
        col.type.toLowerCase().includes("float") ||
        col.type.toLowerCase().includes("number")
    );

    if (numericColumns.length > 0) {
      const column = numericColumns[0];
      examples.push(`-- Analyze ${column.name} in ${table.name}
SELECT MIN(${column.name}), MAX(${column.name}), AVG(${column.name}) FROM ${table.name};`);
    }

    // Date/time examples
    const dateColumns = table.columns.filter(
      (col) =>
        col.type.toLowerCase().includes("date") ||
        col.type.toLowerCase().includes("time") ||
        col.type.toLowerCase().includes("timestamp")
    );

    if (dateColumns.length > 0) {
      const column = dateColumns[0];
      examples.push(`-- Group by ${column.name} in ${table.name}
SELECT DATE(${column.name}), COUNT(*) FROM ${table.name} GROUP BY DATE(${column.name});`);
    }

    // Count and grouping examples
    const textColumns = table.columns.filter(
      (col) =>
        col.type.toLowerCase().includes("varchar") ||
        col.type.toLowerCase().includes("text") ||
        col.type.toLowerCase().includes("char")
    );

    if (textColumns.length > 0) {
      const column =
        textColumns.find((col) => !col.primaryKey) || textColumns[0];
      examples.push(`-- Count unique values in ${column.name}
SELECT ${column.name}, COUNT(*) FROM ${table.name} GROUP BY ${column.name} ORDER BY COUNT(*) DESC;`);
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
JOIN ${fkColumn.foreignKey.table} t2 ON t1.${fkColumn.name} = t2.${fkColumn.foreignKey.column}
LIMIT 10;`);
    }
  }

  // Cross-table analysis examples
  if (schema.length > 1) {
    examples.push(`-- Get row counts for all tables
${schema
  .map(
    (table) =>
      `SELECT '${table.name}' as table_name, COUNT(*) as row_count FROM ${table.name}`
  )
  .join("\nUNION ALL\n")};`);
  }

  return examples.join("\n\n");
}

// Helper function to generate intelligent suggested questions
function generateSuggestedQuestions(
  schema: TableSchema[],
  activeConnection?: DatabaseConnection
): string[] {
  if (schema.length === 0) return [];

  const suggestions = [];

  // Table-specific suggestions
  schema.slice(0, 3).forEach((table) => {
    suggestions.push(`Show me the first 10 rows from ${table.name}`);
    suggestions.push(`What's the structure of the ${table.name} table?`);
    suggestions.push(`How many records are in ${table.name}?`);

    // Column-based suggestions
    const numericColumns = table.columns.filter(
      (col) =>
        col.type.toLowerCase().includes("int") ||
        col.type.toLowerCase().includes("decimal") ||
        col.type.toLowerCase().includes("float") ||
        col.type.toLowerCase().includes("number")
    );

    if (numericColumns.length > 0) {
      const column = numericColumns[0];
      suggestions.push(`What's the average ${column.name} in ${table.name}?`);
      suggestions.push(`Show me the distribution of ${column.name} values`);
    }

    const dateColumns = table.columns.filter(
      (col) =>
        col.type.toLowerCase().includes("date") ||
        col.type.toLowerCase().includes("time") ||
        col.type.toLowerCase().includes("timestamp")
    );

    if (dateColumns.length > 0) {
      const column = dateColumns[0];
      suggestions.push(`Show me trends over time using ${column.name}`);
      suggestions.push(`Group ${table.name} records by ${column.name}`);
    }

    const textColumns = table.columns.filter(
      (col) =>
        col.type.toLowerCase().includes("varchar") ||
        col.type.toLowerCase().includes("text") ||
        col.type.toLowerCase().includes("char")
    );

    if (textColumns.length > 1) {
      const column =
        textColumns.find((col) => !col.primaryKey) || textColumns[0];
      suggestions.push(`What are the unique values in ${column.name}?`);
      suggestions.push(`Find the most common ${column.name} values`);
    }
  });

  // Relationship-based suggestions
  const tablesWithForeignKeys = schema.filter((table) =>
    table.columns.some((col) => col.foreignKey)
  );

  tablesWithForeignKeys.forEach((table) => {
    const fkColumn = table.columns.find((col) => col.foreignKey);
    if (fkColumn?.foreignKey) {
      suggestions.push(
        `Show me ${table.name} data joined with ${fkColumn.foreignKey.table}`
      );
      suggestions.push(
        `Analyze the relationship between ${table.name} and ${fkColumn.foreignKey.table}`
      );
    }
  });

  // Cross-table suggestions
  if (schema.length > 1) {
    suggestions.push(`Compare data across different tables`);
    suggestions.push(`Show me a summary of all tables`);
    suggestions.push(`Find relationships between tables`);
  }

  // Sample data specific suggestions
  if (activeConnection?.sampleData) {
    const sampleTable = activeConnection.sampleData[0];
    if (sampleTable && sampleTable.rows.length > 0) {
      suggestions.push(`Analyze patterns in ${sampleTable.tableName} data`);
      suggestions.push(
        `Find duplicates or anomalies in ${sampleTable.tableName}`
      );
      suggestions.push(`Create a report for ${sampleTable.tableName}`);
    }
  }

  return suggestions;
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

    // Generate suggested questions
    const suggestedQuestions = generateSuggestedQuestions(
      schema,
      activeConnection
    );

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
                .slice(0, 3) // Show only first 3 rows for context
                .map((row: string[]) => `  ${row.join(" | ")}`)
                .join("\n");
              return `Table: ${sample.tableName} (${
                sample.totalRows
              } total rows)
Columns: ${sample.columns.join(", ")}
Sample data:
${sampleRows}${sample.rows.length > 3 ? "\n  ... and more rows" : ""}`;
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

## Suggested Questions Users Might Ask:
${suggestedQuestions
  .slice(0, 8)
  .map((q) => `- ${q}`)
  .join("\n")}

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
- Reference specific table and column names from the schema when relevant
- Provide actionable insights from query results

## Response Format for Query Execution:
1. Brief explanation of what you'll query and why
2. Execute the query using the tool
3. Interpret and explain the results
4. Provide insights or follow-up suggestions

Remember: You're not just generating queries, you're teaching users to understand their data better while providing real insights from their actual data. Always use the actual table names (${schema
      .map((t) => t.name)
      .join(", ")}) and column names when crafting responses and queries.`;

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
    // Enable tools if we have an active SQL connection OR if we have CSV schema
    const hasQueryCapability =
      (activeConnection && activeConnection.connected) ||
      (schema.length > 0 && !activeConnection);

    const result = hasQueryCapability
      ? await streamText({
          ...baseParams,
          tools: {
            execute_query: createExecuteQueryTool(activeConnection, schema),
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
