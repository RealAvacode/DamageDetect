import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Filter, X } from "lucide-react";
import { Grade } from "./GradeBadge";
import { cn } from "@/lib/utils";

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onGradeFilter: (grades: Grade[]) => void;
  onDateRangeFilter: (start: string, end: string) => void;
  className?: string;
}

const gradeOptions: { value: Grade; label: string; color: string }[] = [
  { value: "A", label: "Grade A", color: "bg-chart-1" },
  { value: "B", label: "Grade B", color: "bg-chart-2" },
  { value: "C", label: "Grade C", color: "bg-chart-2" },
  { value: "D", label: "Grade D", color: "bg-chart-3" },
];

export default function SearchFilter({
  onSearch,
  onGradeFilter,
  onDateRangeFilter,
  className
}: SearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<Grade[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const toggleGrade = (grade: Grade) => {
    const newGrades = selectedGrades.includes(grade)
      ? selectedGrades.filter(g => g !== grade)
      : [...selectedGrades, grade];
    
    setSelectedGrades(newGrades);
    onGradeFilter(newGrades);
  };

  const clearGradeFilters = () => {
    setSelectedGrades([]);
    onGradeFilter([]);
  };

  const handleDateRangeChange = () => {
    if (startDate || endDate) {
      onDateRangeFilter(startDate, endDate);
    }
  };

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
    onDateRangeFilter("", "");
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by SKU, brand, or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Button type="submit" data-testid="search-button">
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="toggle-filters"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Grade Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Filter by Grade</Label>
                {selectedGrades.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearGradeFilters}
                    data-testid="clear-grade-filters"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {gradeOptions.map(grade => (
                  <Badge
                    key={grade.value}
                    variant={selectedGrades.includes(grade.value) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer hover-elevate",
                      selectedGrades.includes(grade.value) && grade.color
                    )}
                    onClick={() => toggleGrade(grade.value)}
                    data-testid={`grade-filter-${grade.value}`}
                  >
                    {grade.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Assessment Date Range</Label>
                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearDateFilters}
                    data-testid="clear-date-filters"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="start-date" className="text-xs text-muted-foreground">From</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onBlur={handleDateRangeChange}
                    data-testid="start-date-input"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="text-xs text-muted-foreground">To</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onBlur={handleDateRangeChange}
                    data-testid="end-date-input"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Display */}
      {(selectedGrades.length > 0 || searchQuery || startDate || endDate) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {searchQuery && (
            <Badge variant="outline" data-testid="active-search-filter">
              Search: "{searchQuery}"
              <X 
                className="h-3 w-3 ml-1 cursor-pointer" 
                onClick={() => {
                  setSearchQuery("");
                  onSearch("");
                }}
              />
            </Badge>
          )}

          {selectedGrades.map(grade => (
            <Badge key={grade} variant="outline" data-testid={`active-grade-${grade}`}>
              {grade}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => toggleGrade(grade)}
              />
            </Badge>
          ))}

          {(startDate || endDate) && (
            <Badge variant="outline" data-testid="active-date-filter">
              {startDate} - {endDate || 'Now'}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={clearDateFilters}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}