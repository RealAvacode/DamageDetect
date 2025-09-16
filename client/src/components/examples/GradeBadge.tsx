import GradeBadge, { Grade } from '../GradeBadge'

export default function GradeBadgeExample() {
  const grades: Grade[] = ["A", "B", "C", "D", "PENDING", "ERROR"]

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Grade Badges</h3>
      <div className="flex flex-wrap gap-2">
        {grades.map(grade => (
          <GradeBadge key={grade} grade={grade} />
        ))}
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">Different Sizes</h4>
        <div className="flex flex-wrap items-center gap-2">
          <GradeBadge grade="A" size="sm" />
          <GradeBadge grade="B" size="default" />
          <GradeBadge grade="C" size="lg" />
        </div>
      </div>
    </div>
  )
}