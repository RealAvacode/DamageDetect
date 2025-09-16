import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, Monitor } from "lucide-react";
import GradeBadge, { Grade } from "./GradeBadge";
import { cn } from "@/lib/utils";

export interface LaptopRecord {
  id: string;
  sku: string;
  brand?: string;
  model?: string;
  grade: Grade;
  assessmentDate: string;
  damageDescription?: string;
  imageUrl?: string;
  confidence?: number;
}

interface LaptopCardProps {
  laptop: LaptopRecord;
  onViewDetails: (laptop: LaptopRecord) => void;
  className?: string;
}

export default function LaptopCard({ laptop, onViewDetails, className }: LaptopCardProps) {
  const displayName = laptop.brand && laptop.model 
    ? `${laptop.brand} ${laptop.model}`
    : laptop.sku;

  return (
    <Card className={cn("hover-elevate cursor-pointer transition-all", className)} data-testid={`laptop-card-${laptop.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate" title={displayName}>
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">SKU: {laptop.sku}</p>
          </div>
          <GradeBadge grade={laptop.grade} size="sm" />
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {laptop.imageUrl && (
          <div className="aspect-video bg-muted rounded-md overflow-hidden">
            <img
              src={laptop.imageUrl}
              alt={`${laptop.sku} preview`}
              className="w-full h-full object-cover"
              data-testid={`laptop-image-${laptop.id}`}
            />
          </div>
        )}

        {!laptop.imageUrl && (
          <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
            <Monitor className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {laptop.damageDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={laptop.damageDescription}>
            {laptop.damageDescription}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(laptop.assessmentDate).toLocaleDateString()}
          </div>
          
          {laptop.confidence && (
            <Badge variant="outline" className="text-xs">
              {Math.round(laptop.confidence * 100)}% confidence
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onViewDetails(laptop)}
          data-testid={`view-details-${laptop.id}`}
        >
          <Eye className="h-3 w-3 mr-1" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}