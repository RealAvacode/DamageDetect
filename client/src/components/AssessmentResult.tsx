import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, Eye, Download } from "lucide-react";
import GradeBadge, { Grade } from "./GradeBadge";
import { cn } from "@/lib/utils";

export interface AssessmentData {
  grade: Grade;
  confidence: number;
  damageTypes: string[];
  overallCondition: string;
  detailedFindings: {
    category: string;
    severity: "Low" | "Medium" | "High";
    description: string;
  }[];
  processingTime: number;
  imageAnalyzed: string;
}

interface AssessmentResultProps {
  assessment: AssessmentData;
  onRetry?: () => void;
  onExportReport?: () => void;
  className?: string;
}

export default function AssessmentResult({
  assessment,
  onRetry,
  onExportReport,
  className
}: AssessmentResultProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "High":
        return <AlertTriangle className="h-4 w-4 text-chart-3" />;
      case "Medium":
        return <AlertTriangle className="h-4 w-4 text-chart-2" />;
      default:
        return <CheckCircle className="h-4 w-4 text-chart-1" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High":
        return "border-chart-3/20 bg-chart-3/5";
      case "Medium":
        return "border-chart-2/20 bg-chart-2/5";
      default:
        return "border-chart-1/20 bg-chart-1/5";
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall Grade and Confidence */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Assessment Results</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Processed in {assessment.processingTime}s
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <GradeBadge grade={assessment.grade} size="lg" />
            <div className="text-right">
              <div className="text-2xl font-bold">{Math.round(assessment.confidence * 100)}%</div>
              <div className="text-sm text-muted-foreground">Confidence</div>
            </div>
          </div>
          
          <Progress value={assessment.confidence * 100} className="h-2" />
          
          <p className="text-sm text-muted-foreground">
            {assessment.overallCondition}
          </p>

          {assessment.damageTypes.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Damage Types Detected:</div>
              <div className="flex flex-wrap gap-2">
                {assessment.damageTypes.map(type => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Findings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {assessment.detailedFindings.map((finding, index) => (
            <div
              key={index}
              className={cn(
                "p-3 rounded-lg border",
                getSeverityColor(finding.severity)
              )}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(finding.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{finding.category}</span>
                    <Badge variant="outline" className="text-xs">
                      {finding.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {finding.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Image Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analyzed Image</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            <img
              src={assessment.imageAnalyzed}
              alt="Analyzed laptop"
              className="w-full h-full object-cover"
              data-testid="analyzed-image"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry} data-testid="retry-assessment">
            <Eye className="h-4 w-4 mr-2" />
            Retry Assessment
          </Button>
        )}
        {onExportReport && (
          <Button onClick={onExportReport} data-testid="export-report">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        )}
      </div>
    </div>
  );
}