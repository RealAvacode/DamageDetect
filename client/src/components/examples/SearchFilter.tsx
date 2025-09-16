import SearchFilter from '../SearchFilter'
import { Grade } from '../GradeBadge'

export default function SearchFilterExample() {
  const handleSearch = (query: string) => {
    console.log('Search query:', query)
  }

  const handleGradeFilter = (grades: Grade[]) => {
    console.log('Grade filters:', grades)
  }

  const handleDateRangeFilter = (start: string, end: string) => {
    console.log('Date range:', start, 'to', end)
  }

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Search and Filter</h3>
      <SearchFilter
        onSearch={handleSearch}
        onGradeFilter={handleGradeFilter}
        onDateRangeFilter={handleDateRangeFilter}
      />
    </div>
  )
}