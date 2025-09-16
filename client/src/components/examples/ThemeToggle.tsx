import ThemeToggle from '../ThemeToggle'

export default function ThemeToggleExample() {
  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Theme Toggle</h3>
      <p className="text-sm text-muted-foreground">Click the button to toggle between light and dark modes</p>
      <ThemeToggle />
    </div>
  )
}