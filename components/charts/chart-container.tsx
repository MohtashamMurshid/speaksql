"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTime: number;
}

interface ChartContainerProps {
  data: QueryResult;
  onClose?: () => void;
}

type ChartType = "bar" | "line" | "pie";

interface ChartSuggestion {
  type: ChartType;
  confidence: number;
  reason: string;
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
];

export function ChartContainer({ data, onClose }: ChartContainerProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xColumn, setXColumn] = useState(data.columns[0]);
  const [yColumn, setYColumn] = useState(data.columns[1] || data.columns[0]);

  // Analyze data and suggest best chart types
  const suggestions = useMemo(() => {
    const suggestions: ChartSuggestion[] = [];

    // Check for numeric columns
    const numericColumns = data.columns.filter((col, index) => {
      return data.rows.some(
        (row) => !isNaN(Number(row[index])) && row[index] !== ""
      );
    });

    // Check for date columns
    const dateColumns = data.columns.filter((col, index) => {
      return data.rows.some((row) => !isNaN(Date.parse(row[index])));
    });

    // Suggest bar chart if we have categories and numbers
    if (numericColumns.length > 0 && data.columns.length >= 2) {
      suggestions.push({
        type: "bar",
        confidence: 0.8,
        reason: "Good for comparing values across categories",
      });
    }

    // Suggest line chart if we have dates and numbers
    if (dateColumns.length > 0 && numericColumns.length > 0) {
      suggestions.push({
        type: "line",
        confidence: 0.9,
        reason: "Perfect for time series data",
      });
    }

    // Suggest pie chart if we have categories with counts
    if (data.columns.length === 2 && numericColumns.length === 1) {
      suggestions.push({
        type: "pie",
        confidence: 0.7,
        reason: "Shows proportions of categories",
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }, [data]);

  // Transform data for charts
  const chartData = useMemo(() => {
    const xIndex = data.columns.indexOf(xColumn);
    const yIndex = data.columns.indexOf(yColumn);

    return data.rows.map((row, index) => ({
      name: row[xIndex] || `Row ${index + 1}`,
      value: Number(row[yIndex]) || 0,
      [xColumn]: row[xIndex],
      [yColumn]: Number(row[yIndex]) || 0,
    }));
  }, [data, xColumn, yColumn]);

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0088FE"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Data Visualization</h3>
            <p className="text-sm text-muted-foreground">
              Interactive chart of your query results
            </p>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart Type Selection */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant={chartType === "bar" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("bar")}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Bar
            </Button>
            <Button
              variant={chartType === "line" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("line")}
            >
              <LineChartIcon className="w-4 h-4 mr-2" />
              Line
            </Button>
            <Button
              variant={chartType === "pie" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("pie")}
            >
              <PieChartIcon className="w-4 h-4 mr-2" />
              Pie
            </Button>
          </div>

          {suggestions.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              <TrendingUp className="w-3 h-3 mr-1" />
              Suggested: {suggestions[0].type}
            </Badge>
          )}
        </div>

        {/* Column Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">X-Axis</label>
            <Select value={xColumn} onValueChange={setXColumn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.columns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Y-Axis</label>
            <Select value={yColumn} onValueChange={setYColumn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.columns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chart */}
        <div className="border rounded-lg p-4">{renderChart()}</div>

        {/* Chart Suggestions */}
        {suggestions.length > 0 && (
          <div className="p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Chart Recommendations:</h4>
            <div className="space-y-1">
              {suggestions.slice(0, 2).map((suggestion, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  <strong>
                    {suggestion.type.charAt(0).toUpperCase() +
                      suggestion.type.slice(1)}{" "}
                    Chart
                  </strong>
                  : {suggestion.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
