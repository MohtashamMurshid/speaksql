"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Table, Database, Check } from "lucide-react";
import { DatabaseConnector } from "./database-connector";
import { databaseService } from "@/lib/database-service";

interface TableSchema {
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

interface DataImporterProps {
  onDataImported: (data: ImportedData) => void;
  schema: TableSchema[];
  onSchemaChange: (schema: TableSchema[]) => void;
  onConnectionChange?: (
    connections: DatabaseConnection[],
    activeConnectionId: string | null
  ) => void;
}

interface ImportedData {
  fileName: string;
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    sample: string;
  }>;
  rowCount: number;
  preview: string[][];
  fullData?: string[][]; // Optional full CSV data
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

export function DataImporter({
  onDataImported,
  schema,
  onSchemaChange,
  onConnectionChange,
}: DataImporterProps) {
  const [importedFiles, setImportedFiles] = useState<ImportedData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [addedFiles, setAddedFiles] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectColumnType = (values: string[]): string => {
    // Simple type detection logic
    const nonEmptyValues = values.filter((v) => v && v.trim() !== "");

    if (nonEmptyValues.length === 0) return "VARCHAR(255)";

    // Check for integers
    if (nonEmptyValues.every((v) => /^\d+$/.test(v.trim()))) {
      return "INTEGER";
    }

    // Check for decimals
    if (nonEmptyValues.every((v) => /^\d*\.?\d+$/.test(v.trim()))) {
      return "DECIMAL(10,2)";
    }

    // Check for dates
    if (nonEmptyValues.every((v) => !isNaN(Date.parse(v)))) {
      return "TIMESTAMP";
    }

    // Check for booleans
    if (
      nonEmptyValues.every((v) =>
        ["true", "false", "1", "0", "yes", "no"].includes(v.toLowerCase())
      )
    ) {
      return "BOOLEAN";
    }

    // Default to VARCHAR
    const maxLength = Math.max(...nonEmptyValues.map((v) => v.length));
    return `VARCHAR(${Math.max(255, Math.ceil(maxLength * 1.5))})`;
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      const values = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      values.push(current.trim());
      return values;
    });
  };

  const processFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) return null;

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Detect column types
    const columns = headers.map((header, index) => {
      const columnValues = dataRows.map((row) => row[index] || "");
      const type = detectColumnType(columnValues);
      const sample = columnValues.find((v) => v && v.trim()) || "";

      return {
        name: header.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        type,
        sample,
      };
    });

    const tableName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

    // Store the full CSV data for later import
    const importedData = {
      fileName: file.name,
      tableName,
      columns,
      rowCount: dataRows.length,
      preview: dataRows.slice(0, 5),
      fullData: rows, // Store complete CSV data
    };

    return importedData;
  };

  const handleFileSelect = async (files: FileList) => {
    setIsProcessing(true);

    try {
      const processedFiles = await Promise.all(
        Array.from(files).map(processFile)
      );

      const validFiles = processedFiles.filter(Boolean) as ImportedData[];
      setImportedFiles((prev) => [...prev, ...validFiles]);
    } catch (error) {
      console.error("File processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  const addToSchema = async (importedData: ImportedData) => {
    try {
      // Use the full CSV data if available, otherwise use preview
      const csvData = importedData.fullData || [
        importedData.columns.map((col) => col.name), // Headers
        ...importedData.preview, // Sample data rows
      ];

      await databaseService.importCsvData(
        importedData.fileName,
        importedData.tableName,
        csvData
      );

      // Update the schema from the database
      const newSchema = await databaseService.getSchema();
      onSchemaChange(newSchema);
      onDataImported(importedData);

      // Mark this file as added
      setAddedFiles((prev) => new Set(prev).add(importedData.fileName));
    } catch (error) {
      console.error("Failed to add data to schema:", error);
    }
  };

  const removeImportedFile = (index: number) => {
    setImportedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addAllToSchema = async () => {
    // Get all files that haven't been added yet
    const filesToAdd = importedFiles.filter(
      (file) => !addedFiles.has(file.fileName)
    );
    
    if (filesToAdd.length === 0) return;
    
    setIsAddingAll(true);
    
    try {
      // Add each file to schema
      for (const file of filesToAdd) {
        await addToSchema(file);
      }
    } finally {
      setIsAddingAll(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Data Sources
        </h2>
        <p className="text-muted-foreground">
          Import CSV files or connect to existing SQL databases
        </p>
      </div>
      {/* Database Connections */}
      <DatabaseConnector onConnectionChange={onConnectionChange} />
      {/* CSV Import Section */}
      <div className="border-t pt-10">
        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-foreground mb-3">
            CSV File Import
          </h3>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Upload CSV files and automatically generate database schemas
          </p>
        </div>

        {/* File Drop Zone */}
        <Card
          className={`border-dashed border-2 transition-colors mb-10 ${
            dragOver ? "border-primary bg-accent/30" : "border-border"
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
        >
          <CardContent className="p-12 text-center">
            <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Drop CSV files here
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Or click to select files from your computer
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              size="lg"
              className="px-6"
            >
              <FileText className="w-5 h-5 mr-2" />
              {isProcessing ? "Processing..." : "Select Files"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </CardContent>
        </Card>

        {/* Imported Files */}
        {importedFiles.length > 0 && (
          <div className="space-y-6 mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Imported Files ({importedFiles.length})
              </h3>
              <Button 
                onClick={addAllToSchema} 
                disabled={importedFiles.every(file => addedFiles.has(file.fileName)) || isAddingAll}
                variant="default"
                size="sm"
                className={importedFiles.length > 0 && importedFiles.every(file => addedFiles.has(file.fileName)) 
                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800" 
                  : ""}
              >
                {isAddingAll ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Adding...
                  </>
                ) : importedFiles.length > 0 && importedFiles.every(file => addedFiles.has(file.fileName)) ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    All Added
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Add All to Schema
                  </>
                )}
              </Button>
            </div>

            <div className="grid gap-6">
              {importedFiles.map((file, index) => (
                <Card key={index} className="border-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent rounded-lg">
                          <Table className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{file.fileName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {file.rowCount} rows • {file.columns.length} columns
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToSchema(file)}
                          disabled={addedFiles.has(file.fileName)}
                          className={
                            addedFiles.has(file.fileName)
                              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"
                              : ""
                          }
                        >
                          {addedFiles.has(file.fileName) ? (
                            <>
                              <Check className="w-4 h-4 mr-2 text-green-600" />
                              Added
                            </>
                          ) : (
                            <>
                              <Database className="w-4 h-4 mr-2" />
                              Add to Schema
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeImportedFile(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Column Info */}
                    <div className="mb-6">
                      <h5 className="font-medium mb-3">Detected Columns</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {file.columns.map((column, colIndex) => (
                          <div
                            key={colIndex}
                            className="flex items-center justify-between p-2 bg-muted rounded"
                          >
                            <span className="font-medium text-sm">
                              {column.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {column.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data Preview */}
                    <div>
                      <h5 className="font-medium mb-3">Data Preview</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border rounded">
                          <thead>
                            <tr className="bg-muted">
                              {file.columns.map((column) => (
                                <th
                                  key={column.name}
                                  className="text-left p-2 border-b"
                                >
                                  {column.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {file.preview.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b">
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="p-2">
                                    {cell || "NULL"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Current Schema */}
        {schema.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <h3 className="font-semibold text-lg">Current Database Schema</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {schema.map((table) => (
                  <div key={table.name} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="w-4 h-4 text-primary" />
                      <h4 className="font-medium">{table.name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {table.columns.length} cols
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      {table.columns.map((column) => (
                        <div key={column.name} className="flex justify-between py-1 px-2 rounded hover:bg-accent/50">
                          <span>{column.name}</span>
                          <span className="text-muted-foreground">
                            {column.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>{" "}
      {/* Close CSV Import Section */}
    </div>
  );
}
