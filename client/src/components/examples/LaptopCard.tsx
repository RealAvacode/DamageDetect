import LaptopCard, { LaptopRecord } from '../LaptopCard'

export default function LaptopCardExample() {
  // todo: remove mock functionality
  const mockLaptops: LaptopRecord[] = [
    {
      id: "1",
      sku: "LT001",
      brand: "Dell",
      model: "Latitude 5520",
      grade: "A",
      assessmentDate: "2024-01-15",
      damageDescription: "Excellent condition with minimal wear on keyboard",
      imageUrl: "https://via.placeholder.com/300x200/f3f4f6/9ca3af?text=Dell+Laptop",
      confidence: 0.95
    },
    {
      id: "2", 
      sku: "LT002",
      brand: "HP",
      model: "EliteBook 840",
      grade: "C",
      assessmentDate: "2024-01-14",
      damageDescription: "Moderate scratches on lid, dent on corner, screen in good condition",
      confidence: 0.87
    },
    {
      id: "3",
      sku: "LT003",
      grade: "PENDING",
      assessmentDate: "2024-01-16",
      damageDescription: "Assessment in progress..."
    }
  ]

  const handleViewDetails = (laptop: LaptopRecord) => {
    console.log('View details for:', laptop.sku)
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Laptop Cards</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockLaptops.map(laptop => (
          <LaptopCard
            key={laptop.id}
            laptop={laptop}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>
    </div>
  )
}