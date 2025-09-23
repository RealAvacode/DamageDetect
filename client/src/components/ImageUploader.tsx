import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onImagesSelected: (files: File[]) => void;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

export default function ImageUploader({ 
  onImagesSelected, 
  maxFiles = 5, 
  className,
  disabled = false 
}: ImageUploaderProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled) return;
    
    const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
    const newImages = [...selectedImages, ...imageFiles].slice(0, maxFiles);
    
    setSelectedImages(newImages);
    onImagesSelected(newImages);
    
    // Create previews
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    setPreviews(current => {
      // Cleanup old URLs
      current.forEach(url => URL.revokeObjectURL(url));
      return newPreviews;
    });
  }, [selectedImages, maxFiles, onImagesSelected, disabled]);

  const removeImage = (index: number) => {
    if (disabled) return;
    
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    onImagesSelected(newImages);
    
    // Cleanup old URL and create new previews
    URL.revokeObjectURL(previews[index]);
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    setPreviews(current => {
      current.forEach(url => URL.revokeObjectURL(url));
      return newPreviews;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles,
    disabled
  });

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed p-6 cursor-pointer transition-colors hover-elevate",
          isDragActive && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-50"
        )}
        data-testid="image-uploader-dropzone"
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm">
            {isDragActive ? (
              <p>Drop the images here...</p>
            ) : (
              <>
                <p><span className="font-medium">Click to upload</span> or drag and drop</p>
                <p className="text-muted-foreground">PNG, JPG, WEBP up to 10MB each</p>
                <p className="text-muted-foreground">Maximum {maxFiles} images</p>
              </>
            )}
          </div>
        </div>
      </Card>

      {selectedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <Card className="p-2 hover-elevate">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-24 object-cover rounded-md"
                  data-testid={`preview-image-${index}`}
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(index)}
                  disabled={disabled}
                  data-testid={`remove-image-${index}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}