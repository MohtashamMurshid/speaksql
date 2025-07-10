import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(req: Request) {
  try {
    const { messages, schema } = await req.json();

    // Create a system message with schema context
    const systemMessage = `You are a helpful database assistant that helps users interact with their database using natural language.

Database Schema:
${schema
  .map(
    (table: any) =>
      `Table: ${table.name}
  Columns: ${table.columns
    .map(
      (col: any) =>
        `${col.name} (${col.type})${col.primaryKey ? " [PRIMARY KEY]" : ""}${
          col.foreignKey
            ? ` [FK -> ${col.foreignKey.table}.${col.foreignKey.column}]`
            : ""
        }`
    )
    .join(", ")}`
  )
  .join("\n\n")}

Instructions:
1. Help users understand their data structure and relationships
2. Generate SQL queries when requested
3. Explain database concepts in simple terms
4. Provide query optimization suggestions
5. Always format SQL queries in code blocks with \`\`\`sql
6. Be helpful and educational

When generating SQL queries, ensure they are compatible with the provided schema and follow SQL best practices.`;

    const result = await streamText({
      model: openai("gpt-4o-mini"),
      system: systemMessage,
      messages,
      temperature: 0.7,
      maxTokens: 1000,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
