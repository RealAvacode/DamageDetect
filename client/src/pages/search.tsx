import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import SearchFilter from "@/components/SearchFilter";
import LaptopCard, { LaptopRecord } from "@/components/LaptopCard";
import { Grade } from "@/components/GradeBadge";
import { Search, Database } from "lucide-react";

export default function SearchPage() {
  // todo: remove mock functionality
  const [mockLaptops] = useState<LaptopRecord[]>([
    {
      id: "1",
      sku: "LT001",
      brand: "Dell",
      model: "Latitude 5520",
      grade: "A",
      assessmentDate: "2024-01-15",
      damageDescription: "Excellent condition with minimal wear on keyboard area",
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
      brand: "Lenovo",
      model: "ThinkPad X1",
      grade: "B",
      assessmentDate: "2024-01-13",
      damageDescription: "Good condition with light usage wear, minimal scratches",
      imageUrl: "https://via.placeholder.com/300x200/f3f4f6/9ca3af?text=ThinkPad",
      confidence: 0.92
    },
    {
      id: "4",
      sku: "LT004",
      brand: "Apple",
      model: "MacBook Pro",
      grade: "A",
      assessmentDate: "2024-01-12",
      damageDescription: "Near perfect condition, very minor wear on corners",
      imageUrl: "https://via.placeholder.com/300x200/f3f4f6/9ca3af?text=MacBook",
      confidence: 0.98
    },
    {
      id: "5",
      sku: "LT005",
      brand: "ASUS",
      model: "ZenBook",
      grade: "D",
      assessmentDate: "2024-01-11", 
      damageDescription: "Heavy damage: cracked screen bezel, multiple dents, worn keyboard",
      confidence: 0.89
    },
    {
      id: "6",
      sku: "LT006",
      grade: "PENDING",
      assessmentDate: "2024-01-16",
      damageDescription: "Assessment in progress..."
    }
  ]);

  const [filteredLaptops, setFilteredLaptops] = useState<LaptopRecord[]>(mockLaptops);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<Grade[]>([]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(query, selectedGrades);
  };

  const handleGradeFilter = (grades: Grade[]) => {
    setSelectedGrades(grades);
    applyFilters(searchQuery, grades);
  };

  const handleDateRangeFilter = (start: string, end: string) => {
    console.log('Date range filter:', start, end);
    // TODO: Implement date filtering
  };

  const applyFilters = (query: string, grades: Grade[]) => {
    let filtered = mockLaptops;

    // Apply search query filter
    if (query.trim()) {
      filtered = filtered.filter(laptop => 
        laptop.sku.toLowerCase().includes(query.toLowerCase()) ||
        laptop.brand?.toLowerCase().includes(query.toLowerCase()) ||
        laptop.model?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Apply grade filter
    if (grades.length > 0) {
      filtered = filtered.filter(laptop => grades.includes(laptop.grade));
    }

    setFilteredLaptops(filtered);
  };

  const handleViewDetails = (laptop: LaptopRecord) => {
    console.log('View details for:', laptop.sku);
    // TODO: Navigate to laptop details page or open modal
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Database className="h-8 w-8 text-primary" />
          Assessment Database
        </h1>
        <p className="text-muted-foreground">
          Search and browse laptop assessment records. Filter by grade, date, or search by SKU/model.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8">
        <SearchFilter
          onSearch={handleSearch}
          onGradeFilter={handleGradeFilter}
          onDateRangeFilter={handleDateRangeFilter}
        />
      </div>

      {/* Results */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Assessment Records ({filteredLaptops.length})
          </h2>
        </div>

        {filteredLaptops.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Results Found</h3>
              <p className="text-muted-foreground">
                No laptops match your current search criteria. Try adjusting your filters or search terms.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredLaptops.map(laptop => (
              <LaptopCard
                key={laptop.id}
                laptop={laptop}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}