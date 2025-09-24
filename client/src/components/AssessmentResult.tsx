import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, Eye, Download, Video, Image, Play, Monitor } from "lucide-react";
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
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  videoMetadata?: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    framesAnalyzed: number;
  };
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
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Assessment Results</CardTitle>
              <div className="flex items-center gap-1">
                {assessment.mediaType === 'video' ? (
                  <Video className="h-4 w-4 text-chart-4" data-testid="video-indicator" />
                ) : (
                  <Image className="h-4 w-4 text-chart-1" data-testid="image-indicator" />
                )}
                <Badge variant="outline" className="text-xs" data-testid={`media-type-${assessment.mediaType || 'image'}`}>
                  {assessment.mediaType === 'video' ? 'Video Analysis' : 'Image Analysis'}
                </Badge>
              </div>
            </div>
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

      {/* Video Metadata */}
      {assessment.mediaType === 'video' && assessment.videoMetadata && (
        <Card data-testid="video-metadata-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Video Analysis Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Duration</div>
                <div className="font-medium" data-testid="video-duration">
                  {assessment.videoMetadata.duration.toFixed(1)}s
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Resolution</div>
                <div className="font-medium" data-testid="video-resolution">
                  {assessment.videoMetadata.width} × {assessment.videoMetadata.height}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Frame Rate</div>
                <div className="font-medium" data-testid="video-fps">
                  {assessment.videoMetadata.fps.toFixed(1)} FPS
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Frames Analyzed</div>
                <div className="font-medium" data-testid="video-frames-analyzed">
                  {assessment.videoMetadata.framesAnalyzed}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Media Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {assessment.mediaType === 'video' ? (
              <>
                <Play className="h-4 w-4" />
                Analyzed Video Frame
              </>
            ) : (
              <>
                <Image className="h-4 w-4" />
                Analyzed Image
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            <img
              src={assessment.mediaUrl}
              alt={assessment.mediaType === 'video' ? 'Analyzed video frame' : 'Analyzed laptop'}
              className="w-full h-full object-cover"
              data-testid={assessment.mediaType === 'video' ? 'analyzed-video-frame' : 'analyzed-image'}
            />
          </div>
          {assessment.mediaType === 'video' && (
            <p className="text-xs text-muted-foreground mt-2" data-testid="video-analysis-note">
              Analysis performed on {assessment.videoMetadata?.framesAnalyzed || 'multiple'} frame(s) extracted from the video
            </p>
          )}
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