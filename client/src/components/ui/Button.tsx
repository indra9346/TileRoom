import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { springSnappy } from "./motion";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

// motion.button's drag/animation event props conflict in type with the native DOM equivalents;
// this component only ever uses whileTap (no drag gestures), so the plain DOM handlers are kept.
type ConflictingMotionProps = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingMotionProps> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-stone-900 text-white shadow-sm hover:bg-stone-925 hover:shadow-lift disabled:bg-stone-400 disabled:shadow-none",
  secondary: "bg-clay-100 text-clay-900 ring-1 ring-inset ring-hairline hover:bg-clay-200 disabled:bg-stone-100 disabled:text-stone-400",
  outline: "border border-stone-300 bg-white/60 text-stone-900 hover:border-stone-400 hover:bg-white hover:shadow-soft disabled:text-stone-400 disabled:border-stone-200",
  ghost: "text-stone-700 hover:bg-stone-100 disabled:text-stone-400",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 hover:shadow-md disabled:bg-red-300",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3.5 py-2 rounded-lg min-h-9",
  md: "text-sm px-5 py-2.5 rounded-lg min-h-11",
  lg: "text-base px-7 py-3.5 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97, y: 0 }}
      transition={springSnappy}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-medium transition-[background-color,border-color,color,box-shadow] duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </motion.button>
  );
});
