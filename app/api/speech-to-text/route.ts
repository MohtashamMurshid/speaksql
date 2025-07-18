import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  // Create a temporary file path first, before we receive the data
  const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.webm`);
  
  try {
    const formData = await request.formData();
    const audioFile = formData.get("file") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    console.log("Received audio file:", audioFile.name, audioFile.type, audioFile.size, "bytes");

    // Write the blob data to a file
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFilePath, buffer);

    console.log("Saved audio to temporary file:", tempFilePath, "Size:", buffer.length, "bytes");

    // Verify the file was created
    if (!fs.existsSync(tempFilePath)) {
      throw new Error("Failed to create temporary audio file");
    }

    const fileStats = fs.statSync(tempFilePath);
    console.log("File stats:", fileStats.size, "bytes");

    // Check if the file is empty
    if (fileStats.size === 0) {
      throw new Error("Audio file is empty");
    }

    // Use fs.createReadStream as shown in the OpenAI docs
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    console.log("Transcription successful:", transcription.text.substring(0, 50) + "...");
    return NextResponse.json({ text: transcription.text });
  } catch (error: unknown) {
    console.error("Speech-to-text error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to transcribe audio";
    
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    // Clean up the temporary file
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("Cleaned up temporary file:", tempFilePath);
      } catch (e) {
        console.error("Error deleting temp file:", e);
      }
    }
  }
} 