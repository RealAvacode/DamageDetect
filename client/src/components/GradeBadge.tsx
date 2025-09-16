import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Grade = "A" | "B" | "C" | "D" | "PENDING" | "ERROR";

interface GradeBadgeProps {
  grade: Grade;
  size?: "sm" | "default" | "lg";
  className?: string;
}

const gradeConfig = {
  A: {
    label: "Grade A - Excellent",
    className: "bg-chart-1 text-white hover:bg-chart-1/90",
    description: "Minimal to no visible damage"
  },
  B: {
    label: "Grade B - Good", 
    className: "bg-chart-2 text-black hover:bg-chart-2/90",
    description: "Light wear, minor scratches"
  },
  C: {
    label: "Grade C - Fair",
    className: "bg-chart-2 text-black hover:bg-chart-2/90", 
    description: "Moderate wear, visible damage"
  },
  D: {
    label: "Grade D - Poor",
    className: "bg-chart-3 text-white hover:bg-chart-3/90",
    description: "Heavy damage, significant wear"
  },
  PENDING: {
    label: "Processing...",
    className: "bg-muted text-muted-foreground",
    description: "Assessment in progress"
  },
  ERROR: {
    label: "Assessment Failed",
    className: "bg-destructive text-destructive-foreground",
    description: "Unable to assess condition"
  }
};

export default function GradeBadge({ grade, size = "default", className }: GradeBadgeProps) {
  const config = gradeConfig[grade];
  
  return (
    <Badge
      variant="secondary"
      className={cn(
        config.className,
        size === "sm" && "text-xs px-2 py-0.5",
        size === "lg" && "text-base px-3 py-1",
        "font-medium",
        className
      )}
      title={config.description}
      data-testid={`grade-badge-${grade}`}
    >
      {config.label}
    </Badge>
  );
}