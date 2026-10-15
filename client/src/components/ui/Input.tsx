import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Text field with an animated champagne focus halo (see `.field-focus` in index.css). */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "field-focus w-full min-w-0 rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink shadow-[inset_0_1px_2px_rgba(20,16,12,0.04)]",
        "placeholder:text-ink-secondary/70",
        "disabled:cursor-not-allowed disabled:bg-surface-app disabled:text-ink-secondary/60",
        className,
      )}
      {...props}
    />
  );
});
