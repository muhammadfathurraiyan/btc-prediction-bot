import { cn } from "../../lib/cn";

type SwitchVariant = "green" | "amber";

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  variant?: SwitchVariant;
}

export function Switch({ checked, onChange, variant = "green" }: SwitchProps) {
  const activeBorder = variant === "amber" ? "border-pm-amber" : "border-pm-green";
  const activeBg = variant === "amber" ? "bg-pm-amber/35" : "bg-pm-green/35";
  const thumbActive = variant === "amber" ? "bg-pm-amber" : "bg-pm-green";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-[10px] border p-0.5 transition-colors",
        checked ? cn(activeBorder, activeBg) : "border-pm-border-strong bg-pm-text-quinary",
      )}
    >
      <span
        className={cn(
          "block size-3.5 rounded-full transition-transform",
          checked ? cn("translate-x-4", thumbActive) : "translate-x-0 bg-pm-muted",
        )}
      />
    </button>
  );
}
