import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import MediaUploader from "@/components/ImageUploader";
import AssessmentResult, { AssessmentData } from "@/components/AssessmentResult";
import DiagnosticChatbot from "@/components/DiagnosticChatbot";
import { Upload, Zap, Database, Search, MessageSquare, Bot } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState<AssessmentData[]>([]);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setAssessmentResults([]);
  };

  const handleStartAssessment = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsAssessing(true);
    setAssessmentResults([]);
    
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
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
      
      if (!result.success) {
        throw new Error('Assessment failed');
      }

      const isImageFile = (file: File) =>
        file.type.startsWith('image/') ||
        (file.type === 'application/octet-stream' && file.name.match(/\.(heic|heif)$/i));

      const isVideoFile = (file: File) => file.type.startsWith('video/');

      const imageFiles = selectedFiles.filter(isImageFile);
      const videoFiles = selectedFiles.filter(isVideoFile);

      const successAssessments: AssessmentData[] = [];

      const imageBatchResult = result.results?.find((entry: any) => entry.type === 'image-batch' && entry.success);
      if (imageBatchResult?.assessment) {
        const analyses = (imageBatchResult.assessment.imageAnalyses || []).map((analysis: any) => {
          const fileIndex = analysis.imageIndex ? analysis.imageIndex - 1 : 0;
          const matchingFile = imageFiles[fileIndex] || imageFiles.find(file => file.name === analysis.originalFileName);
          return {
            imageIndex: analysis.imageIndex,
            summary: analysis.summary,
            damageTypes: analysis.damageTypes || [],
            detailedFindings: analysis.detailedFindings || [],
            originalFileName: matchingFile?.name || analysis.originalFileName,
            mediaUrl: matchingFile ? URL.createObjectURL(matchingFile) : undefined
          };
        });

        successAssessments.push({
          grade: imageBatchResult.assessment.grade,
          confidence: imageBatchResult.assessment.confidence,
          damageTypes: imageBatchResult.assessment.damageTypes || [],
          overallCondition: imageBatchResult.assessment.damageDescription || imageBatchResult.assessment.overallCondition,
          detailedFindings: imageBatchResult.assessment.detailedFindings || [],
          processingTime: imageBatchResult.assessment.processingTime,
          mediaType: 'image',
          mediaAnalyses: analyses
        });
      }

      const videoResults = result.results?.filter((entry: any) => entry.type === 'video' && entry.success) || [];
      const videoFileMap = new Map<string, File>();
      videoFiles.forEach(file => {
        videoFileMap.set(file.name, file);
      });

      videoResults.forEach((videoResult: any) => {
        const matchingFile = videoFileMap.get(videoResult.originalFileName);
        successAssessments.push({
          grade: videoResult.assessment.grade,
          confidence: videoResult.assessment.confidence,
          damageTypes: videoResult.assessment.damageTypes || [],
          overallCondition: videoResult.assessment.damageDescription || videoResult.assessment.overallCondition,
          detailedFindings: videoResult.assessment.detailedFindings || [],
          processingTime: videoResult.assessment.processingTime,
          mediaUrl: matchingFile ? URL.createObjectURL(matchingFile) : undefined,
          mediaType: 'video',
          videoMetadata: videoResult.assessment.videoMetadata
        });
      });

      if (result.results) {
        const failedEntries = result.results.filter((entry: any) => entry.success === false);
        if (failedEntries.length > 0) {
          const errorMessages = failedEntries.map((entry: any) => `${entry.originalFileName || 'File'}: ${entry.error || 'Unknown error'}`).join('\n');
          alert(`Some files could not be analyzed:\n${errorMessages}`);
        }
      }

      if (successAssessments.length === 0) {
        throw new Error('Assessment failed');
      }

      setAssessmentResults(successAssessments);
    } catch (error) {
      console.error('Assessment error:', error);
      // Show error to user - for now just log, but could add toast notification
      alert(`Assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAssessing(false);
    }
  };

  const handleRetryAssessment = () => {
    setAssessmentResults([]);
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
      const reportTitle = assessment.mediaType === 'video' ? 
        'Laptop Video Assessment Report' : 'Laptop Damage Assessment Report';
      doc.text(reportTitle, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Generated date and analysis type
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.text(`Analysis Type: ${assessment.mediaType?.toUpperCase() || 'IMAGE'}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Add video metadata if available
      if (assessment.mediaType === 'video' && assessment.videoMetadata) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Video Analysis Details', 20, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Duration: ${assessment.videoMetadata.duration.toFixed(1)}s`, 20, yPosition);
        yPosition += 6;
        doc.text(`Resolution: ${assessment.videoMetadata.width} × ${assessment.videoMetadata.height}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Frame Rate: ${assessment.videoMetadata.fps.toFixed(1)} FPS`, 20, yPosition);
        yPosition += 6;
        doc.text(`Frames Analyzed: ${assessment.videoMetadata.framesAnalyzed}`, 20, yPosition);
        yPosition += 15;
      }

      if (assessment.mediaAnalyses && assessment.mediaAnalyses.length > 0) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Individual Image Analyses', 20, yPosition);
        yPosition += 10;

        for (const analysis of assessment.mediaAnalyses) {
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`Image ${analysis.imageIndex}${analysis.originalFileName ? ` - ${analysis.originalFileName}` : ''}`, 20, yPosition);
          yPosition += 8;

          if (analysis.mediaUrl) {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();

              await new Promise((resolve, reject) => {
                img.onload = () => {
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

                  const imgData = canvas.toDataURL('image/jpeg', 0.8);
                  doc.addImage(imgData, 'JPEG', 20, yPosition, width, height);
                  resolve(null);
                };
                img.onerror = reject;
                img.src = analysis.mediaUrl!;
              });

              yPosition += 85;
            } catch (error) {
              console.warn('Could not add image to PDF:', error);
            }
          }

          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          yPosition = addWrappedText(analysis.summary, 20, yPosition, pageWidth - 40, 11);
          yPosition += 6;

          if (analysis.damageTypes.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text('Damage Types:', 20, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            analysis.damageTypes.forEach(type => {
              doc.text(`• ${type}`, 25, yPosition);
              yPosition += 5;
            });
            yPosition += 4;
          }

          if (analysis.detailedFindings.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text('Detailed Findings:', 20, yPosition);
            yPosition += 6;

            doc.setFont('helvetica', 'normal');
            analysis.detailedFindings.forEach((finding, index) => {
              if (yPosition > pageHeight - 40) {
                doc.addPage();
                yPosition = 20;
              }

              doc.text(`${index + 1}. ${finding.category} (${finding.severity})`, 25, yPosition);
              yPosition += 6;
              yPosition = addWrappedText(finding.description, 30, yPosition, pageWidth - 50, 10);
              yPosition += 4;
            });
          }

          yPosition += 10;
        }
      } else if (assessment.mediaUrl) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();

          await new Promise((resolve, reject) => {
            img.onload = () => {
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

              const imgData = canvas.toDataURL('image/jpeg', 0.8);
              doc.addImage(imgData, 'JPEG', (pageWidth - width) / 2, yPosition, width, height);
              resolve(null);
            };
            img.onerror = reject;
            img.src = assessment.mediaUrl;
          });

          yPosition += 90;
        } catch (error) {
          console.warn('Could not add image to PDF:', error);
        }
      }

      // Assessment Summary
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

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
      const filePrefix = assessment.mediaType === 'video' ? 'video-assessment' : 'laptop-assessment';
      const fileName = `${filePrefix}-${assessment.grade}-${Date.now()}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Bot className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold">AI Diagnostic Assistant</h1>
        </div>
        <p className="text-xl text-muted-foreground mb-4">
          Chat with our AI to diagnose laptop issues and get instant analysis
        </p>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="default" className="px-3 py-1">
            <MessageSquare className="h-3 w-3 mr-1" />
            Conversational AI
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            <Upload className="h-3 w-3 mr-1" />
            Image & Video Analysis
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            <Zap className="h-3 w-3 mr-1" />
            Instant Results
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chatbot - Primary Interface */}
        <div className="lg:col-span-2 space-y-6">
          <DiagnosticChatbot className="w-full" />
          
          {/* Quick Start Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Quick Start Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-semibold">1</div>
                <div>
                  <p className="font-medium">Start a Conversation</p>
                  <p className="text-sm text-muted-foreground">Ask about your laptop issues or describe what you're seeing</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-semibold">2</div>
                <div>
                  <p className="font-medium">Upload Media</p>
                  <p className="text-sm text-muted-foreground">Use the upload button in chat to share photos or videos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-semibold">3</div>
                <div>
                  <p className="font-medium">Get Instant Analysis</p>
                  <p className="text-sm text-muted-foreground">Receive detailed diagnostic reports and recommendations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Traditional Options & Features */}
        <div className="lg:col-span-1 space-y-6">
          {/* Traditional Upload Option */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Direct Upload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Prefer the traditional approach? Upload files directly for analysis.
              </p>
              
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="upload" data-testid="upload-tab" className="justify-start">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Assess
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4 mt-4">
                  <MediaUploader
                    onFilesSelected={handleFilesSelected}
                    maxFiles={5}
                    disabled={isAssessing}
                    acceptedTypes="both"
                  />
                  
                  {selectedFiles.length > 0 && assessmentResults.length === 0 && (
                    <Button 
                      onClick={handleStartAssessment}
                      disabled={isAssessing}
                      className="w-full"
                      size="sm"
                      data-testid="start-assessment"
                    >
                      {isAssessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Start Assessment
                        </>
                      )}
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Features Overview */}
          <Card>
            <CardHeader>
              <CardTitle>AI Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 mt-0.5 text-chart-2 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Advanced AI Analysis</p>
                  <p className="text-xs text-muted-foreground">Damage detection, condition grading, and detailed assessments</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 mt-0.5 text-chart-1 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Natural Conversation</p>
                  <p className="text-xs text-muted-foreground">Ask questions, get explanations, and receive guidance</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 mt-0.5 text-chart-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Assessment History</p>
                  <p className="text-xs text-muted-foreground">Track and compare previous diagnoses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Option */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Browse assessment history and search previous diagnostic records.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full" 
                asChild
                data-testid="link-search-records"
              >
                <Link href="/search">
                  <Search className="h-4 w-4 mr-2" />
                  Browse Records
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Assessment Results */}
      {assessmentResults.length > 0 && (
        <div className="mt-8 space-y-8">
          {assessmentResults.map((assessment, index) => (
            <AssessmentResult
              key={index}
              assessment={assessment}
              onRetry={handleRetryAssessment}
              onExportReport={() => handleExportReport(assessment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}