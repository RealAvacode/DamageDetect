import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImageUploader from "@/components/ImageUploader";
import AssessmentResult, { AssessmentData } from "@/components/AssessmentResult";
import { Upload, Zap, Database, Search } from "lucide-react";

export default function Home() {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentData | null>(null);

  const handleImagesSelected = (files: File[]) => {
    setSelectedImages(files);
    setAssessmentResult(null);
  };

  const handleStartAssessment = async () => {
    if (selectedImages.length === 0) return;
    
    setIsAssessing(true);
    
    try {
      const formData = new FormData();
      selectedImages.forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch('/api/assessments', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Assessment failed');
      }

      const result = await response.json();
      
      if (result.success) {
        const assessmentData: AssessmentData = {
          grade: result.assessment.grade,
          confidence: result.assessment.confidence,
          damageTypes: result.assessment.damageTypes || [],
          overallCondition: result.assessment.damageDescription || result.overallCondition,
          detailedFindings: result.assessment.detailedFindings || result.detailedFindings || [],
          processingTime: result.assessment.processingTime,
          imageAnalyzed: URL.createObjectURL(selectedImages[0])
        };
        
        setAssessmentResult(assessmentData);
      } else {
        throw new Error('Assessment failed');
      }
    } catch (error) {
      console.error('Assessment error:', error);
      // Show error to user - for now just log, but could add toast notification
      alert(`Assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAssessing(false);
    }
  };

  const handleRetryAssessment = () => {
    setAssessmentResult(null);
    handleStartAssessment();
  };

  const handleExportReport = async (assessment: AssessmentData) => {
    try {
      // Dynamically import jsPDF to avoid SSR issues
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Helper function to add text with word wrapping
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 12) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return y + (lines.length * fontSize * 0.4);
      };

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Laptop Damage Assessment Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Generated date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;

      // Add laptop image if available
      if (assessment.imageAnalyzed) {
        try {
          // Create a canvas to resize and process the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          await new Promise((resolve, reject) => {
            img.onload = () => {
              // Calculate dimensions to fit within PDF
              const maxWidth = 120;
              const maxHeight = 80;
              let { width, height } = img;
              
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
              }

              canvas.width = width;
              canvas.height = height;
              ctx?.drawImage(img, 0, 0, width, height);
              
              // Add image to PDF
              const imgData = canvas.toDataURL('image/jpeg', 0.8);
              doc.addImage(imgData, 'JPEG', (pageWidth - width) / 2, yPosition, width, height);
              resolve(null);
            };
            img.onerror = reject;
            img.src = assessment.imageAnalyzed;
          });
          
          yPosition += 90;
        } catch (error) {
          console.warn('Could not add image to PDF:', error);
        }
      }

      // Assessment Summary
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Assessment Summary', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      // Grade with color coding
      const gradeColors: Record<string, [number, number, number]> = {
        'A': [34, 197, 94], // green
        'B': [245, 158, 11], // amber
        'C': [245, 158, 11], // amber
        'D': [239, 68, 68] // red
      };
      
      doc.setTextColor(...(gradeColors[assessment.grade] || [0, 0, 0]));
      doc.setFont('helvetica', 'bold');
      doc.text(`Grade: ${assessment.grade}`, 20, yPosition);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text(`Confidence: ${Math.round(assessment.confidence * 100)}%`, 80, yPosition);
      yPosition += 8;
      
      doc.text(`Processing Time: ${assessment.processingTime}s`, 20, yPosition);
      yPosition += 15;

      // Overall Condition
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Overall Condition', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      yPosition = addWrappedText(assessment.overallCondition, 20, yPosition, pageWidth - 40, 11);
      yPosition += 10;

      // Damage Types
      if (assessment.damageTypes.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Damage Types Identified', 20, yPosition);
        yPosition += 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        assessment.damageTypes.forEach(type => {
          doc.text(`• ${type}`, 25, yPosition);
          yPosition += 6;
        });
        yPosition += 5;
      }

      // Detailed Findings
      if (assessment.detailedFindings.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Findings', 20, yPosition);
        yPosition += 8;

        assessment.detailedFindings.forEach((finding, index) => {
          // Check if we need a new page
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`${index + 1}. ${finding.category}`, 20, yPosition);
          
          // Severity badge color
          const severityColors: Record<string, [number, number, number]> = {
            'Low': [34, 197, 94],
            'Medium': [245, 158, 11],
            'High': [239, 68, 68]
          };
          
          doc.setTextColor(...(severityColors[finding.severity] || [0, 0, 0]));
          doc.text(`(${finding.severity})`, 120, yPosition);
          doc.setTextColor(0, 0, 0);
          yPosition += 8;

          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          yPosition = addWrappedText(finding.description, 25, yPosition, pageWidth - 50, 11);
          yPosition += 8;
        });
      }

      // Footer
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = pageHeight - 20;
      } else {
        yPosition = pageHeight - 20;
      }
      
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('Generated by Laptop Assessment System', pageWidth / 2, yPosition, { align: 'center' });

      // Save the PDF
      const fileName = `laptop-assessment-${assessment.grade}-${Date.now()}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Laptop Damage Assessment</h1>
        <p className="text-muted-foreground">
          Upload laptop images for AI-powered condition analysis and quality grading
        </p>
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="text-center p-4">
          <Upload className="h-8 w-8 mx-auto mb-2 text-chart-4" />
          <h3 className="font-medium mb-1">Upload Images</h3>
          <p className="text-sm text-muted-foreground">Drag & drop or select laptop photos</p>
        </Card>
        <Card className="text-center p-4">
          <Zap className="h-8 w-8 mx-auto mb-2 text-chart-2" />
          <h3 className="font-medium mb-1">AI Analysis</h3>
          <p className="text-sm text-muted-foreground">Advanced damage detection & grading</p>
        </Card>
        <Card className="text-center p-4">
          <Database className="h-8 w-8 mx-auto mb-2 text-chart-1" />
          <h3 className="font-medium mb-1">Searchable Database</h3>
          <p className="text-sm text-muted-foreground">Store & retrieve assessment records</p>
        </Card>
      </div>

      {/* Assessment Workflow */}
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" data-testid="upload-tab">Upload & Assess</TabsTrigger>
          <TabsTrigger value="search" data-testid="search-tab">
            <Search className="h-4 w-4 mr-1" />
            Search Records
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Laptop Images</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUploader
                onImagesSelected={handleImagesSelected}
                maxFiles={5}
                disabled={isAssessing}
              />
              
              {selectedImages.length > 0 && !assessmentResult && (
                <div className="mt-4 pt-4 border-t">
                  <Button 
                    onClick={handleStartAssessment}
                    disabled={isAssessing}
                    className="w-full"
                    size="lg"
                    data-testid="start-assessment"
                  >
                    {isAssessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analyzing Images...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Start AI Assessment
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {assessmentResult && (
            <AssessmentResult 
              assessment={assessmentResult}
              onRetry={handleRetryAssessment}
              onExportReport={() => handleExportReport(assessmentResult)}
            />
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">Search Database</h3>
              <p className="text-muted-foreground mb-4">
                Search and browse previously assessed laptops. This feature will be available once you start creating assessment records.
              </p>
              <Button variant="outline" disabled>
                Browse Assessment Records
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}