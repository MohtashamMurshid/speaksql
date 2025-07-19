import { NextRequest, NextResponse } from "next/server";
import { databaseService } from "@/lib/database-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body as { query: string };

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Execute the query using the database service
    const result = await databaseService.executeQuery(query);

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
