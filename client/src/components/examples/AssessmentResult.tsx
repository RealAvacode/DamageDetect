import AssessmentResult, { AssessmentData } from '../AssessmentResult'

export default function AssessmentResultExample() {
  // todo: remove mock functionality
  const mockAssessment: AssessmentData = {
    grade: "B",
    confidence: 0.87,
    damageTypes: ["Surface Scratches", "Corner Wear", "Minor Denting"],
    overallCondition: "Good condition laptop with light usage wear. Suitable for business use with minor cosmetic imperfections that don't affect functionality.",
    detailedFindings: [
      {
        category: "Display Lid",
        severity: "Low",
        description: "Minor scratches visible on the lid surface, primarily on the left corner. No cracks or deep damage detected."
      },
      {
        category: "Base/Keyboard Area", 
        severity: "Medium",
        description: "Moderate wear around palmrest area with some key shine. Function keys show normal usage patterns."
      },
      {
        category: "Corners & Edges",
        severity: "Medium", 
        description: "Slight corner wear on front right edge. Small dent detected on rear left corner, approximately 2mm depth."
      },
      {
        category: "Ports & Connectivity",
        severity: "Low",
        description: "All ports appear clean and undamaged. USB ports show minimal wear consistent with normal use."
      }
    ],
    processingTime: 3.2,
    imageAnalyzed: "https://via.placeholder.com/400x300/f3f4f6/9ca3af?text=Laptop+Analysis"
  }

  const handleRetry = () => {
    console.log('Retry assessment triggered')
  }

  const handleExportReport = () => {
    console.log('Export report triggered')
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Assessment Results</h3>
      <AssessmentResult
        assessment={mockAssessment}
        onRetry={handleRetry}
        onExportReport={handleExportReport}
      />
    </div>
  )
}