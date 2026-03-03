interface StepIndicatorProps {
  total: number;
  current: number;
  onSelect: (step: number) => void;
}

export function StepIndicator({ total, current, onSelect }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`w-2 h-2 rounded-full transition-all duration-200 ${
            i === current
              ? "bg-dash-blue w-4"
              : "bg-dash-text-muted hover:bg-dash-text-dim"
          }`}
          aria-label={`Step ${i + 1}`}
        />
      ))}
    </div>
  );
}
