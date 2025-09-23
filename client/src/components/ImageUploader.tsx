import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
  acceptedTypes?: 'images' | 'videos' | 'both';
}

export default function MediaUploader({ 
  onFilesSelected, 
  maxFiles = 5, 
  className,
  disabled = false,
  acceptedTypes = 'both'
}: MediaUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileTypes, setFileTypes] = useState<('image' | 'video')[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled) return;
    
    const validFiles = acceptedFiles.filter(file => {
      const isImage = file.type.startsWith('image/') || 
                     // Handle HEIC files which browsers sometimes report as application/octet-stream
                     (file.type === 'application/octet-stream' && file.name.match(/\.(heic|heif)$/i));
      const isVideo = file.type.startsWith('video/');
      
      if (acceptedTypes === 'images') return isImage;
      if (acceptedTypes === 'videos') return isVideo;
      return isImage || isVideo;
    });
    
    const newFiles = [...selectedFiles, ...validFiles].slice(0, maxFiles);
    
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
    
    // Create previews and track file types
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    const newFileTypes = newFiles.map(file => 
      (file.type.startsWith('image/') || 
       (file.type === 'application/octet-stream' && file.name.match(/\.(heic|heif)$/i))) ? 'image' : 'video'
    );
    
    setPreviews(current => {
      // Cleanup old URLs
      current.forEach(url => URL.revokeObjectURL(url));
      return newPreviews;
    });
    setFileTypes(newFileTypes);
  }, [selectedFiles, maxFiles, onFilesSelected, disabled, acceptedTypes]);

  const removeFile = (index: number) => {
    if (disabled) return;
    
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
    
    // Cleanup old URL and create new previews
    URL.revokeObjectURL(previews[index]);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    const newFileTypes = newFiles.map(file => 
      (file.type.startsWith('image/') || 
       (file.type === 'application/octet-stream' && file.name.match(/\.(heic|heif)$/i))) ? 'image' : 'video'
    );
    
    setPreviews(current => {
      current.forEach(url => URL.revokeObjectURL(url));
      return newPreviews;
    });
    setFileTypes(newFileTypes);
  };

  const getAcceptTypes = () => {
    const imageTypes = { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.heic', '.heif'] };
    const videoTypes = { 'video/*': ['.mp4', '.webm', '.mov', '.avi', '.mkv'] };
    
    if (acceptedTypes === 'images') return imageTypes;
    if (acceptedTypes === 'videos') return videoTypes;
    return { ...imageTypes, ...videoTypes };
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptTypes(),
    maxFiles,
    disabled
  });

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed p-6 cursor-pointer transition-colors hover-elevate relative",
          isDragActive && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-50"
        )}
        data-testid="media-uploader-dropzone"
      >
        <input {...getInputProps()} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm">
            {isDragActive ? (
              <p>Drop the files here...</p>
            ) : (
              <>
                <p><span className="font-medium">Click to upload</span> or drag and drop</p>
                {acceptedTypes === 'images' && (
                  <p className="text-muted-foreground">PNG, JPG, WEBP, HEIC up to 10MB each</p>
                )}
                {acceptedTypes === 'videos' && (
                  <p className="text-muted-foreground">MP4, WEBM, MOV up to 50MB each</p>
                )}
                {acceptedTypes === 'both' && (
                  <p className="text-muted-foreground">Images (PNG, JPG, WEBP, HEIC) or Videos (MP4, WEBM, MOV)</p>
                )}
                <p className="text-muted-foreground">Maximum {maxFiles} files</p>
              </>
            )}
          </div>
        </div>
      </Card>

      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <Card className="p-2 hover-elevate">
                <div className="relative">
                  {fileTypes[index] === 'image' ? (
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-md"
                      data-testid={`preview-image-${index}`}
                    />
                  ) : (
                    <div className="relative">
                      <video
                        src={preview}
                        className="w-full h-24 object-cover rounded-md"
                        data-testid={`preview-video-${index}`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                        <Video className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-1 left-1">
                    {fileTypes[index] === 'image' ? (
                      <ImageIcon className="h-3 w-3 text-white bg-black/50 rounded p-0.5" />
                    ) : (
                      <Video className="h-3 w-3 text-white bg-black/50 rounded p-0.5" />
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  data-testid={`remove-file-${index}`}
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