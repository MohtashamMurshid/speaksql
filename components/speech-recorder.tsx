"use client";

import { useState } from "react";
import { useReactMediaRecorder } from "react-media-recorder";
import { Button } from "@/components/ui/button";
import { Mic, Loader2 } from "lucide-react";

interface SpeechRecorderProps {
  onTranscription: (text: string, autoSubmit: boolean) => void;
  disabled?: boolean;
}

export function SpeechRecorder({ onTranscription, disabled = false }: SpeechRecorderProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const { status, startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    blobPropertyBag: { type: "audio/webm" },
    onStop: async (blobUrl, blob) => {
      if (!blob) return;
      
      try {
        setIsTranscribing(true);
        
        // Create form data with the audio blob
        const formData = new FormData();
        
        // Create a proper audio file with webm MIME type
        const audioFile = new File([blob], "audio.webm", { 
          type: "audio/webm" 
        });
        
        formData.append("file", audioFile);
        
        // Send to our API endpoint
        const response = await fetch("/api/speech-to-text", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP error ${response.status}: ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.text) {
          // Pass true to autoSubmit the form
          onTranscription(data.text, true);
        } else if (data.error) {
          console.error("Transcription error:", data.error);
        }
      } catch (error) {
        console.error("Error sending audio for transcription:", error);
      } finally {
        setIsTranscribing(false);
      }
    },
  });
  
  const isRecording = status === "recording";
  
  return (
    <Button
      onClick={isRecording ? stopRecording : startRecording}
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      disabled={disabled || isTranscribing}
      className="rounded-full"
      title={isRecording ? "Stop recording" : "Start voice recording"}
      type="button" // Ensure it doesn't submit a form when clicked
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
      )}
    </Button>
  );
} 