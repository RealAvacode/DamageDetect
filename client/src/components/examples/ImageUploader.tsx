import MediaUploader from '../ImageUploader'

export default function ImageUploaderExample() {
  const handleFilesSelected = (files: File[]) => {
    console.log('Files selected:', files.map(f => f.name))
  }

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Upload Laptop Images</h3>
      <MediaUploader 
        onFilesSelected={handleFilesSelected}
        maxFiles={5}
        acceptedTypes="both"
      />
    </div>
  )
}