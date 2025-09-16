import ImageUploader from '../ImageUploader'

export default function ImageUploaderExample() {
  const handleImagesSelected = (files: File[]) => {
    console.log('Images selected:', files.map(f => f.name))
  }

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Upload Laptop Images</h3>
      <ImageUploader 
        onImagesSelected={handleImagesSelected}
        maxFiles={5}
      />
    </div>
  )
}