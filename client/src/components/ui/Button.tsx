import { cn } from "@/lib/utils";
import { ButtonProps } from "@/types";

/**
 * Reusable Button component following KISS and DRY principles
 * Single responsibility: Handle button rendering and styling
 */
export function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  className,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-300 transform hover:scale-105 backdrop-blur-sm rounded-full";

  const variantStyles = {
    primary:
      "bg-purple-600 hover:bg-purple-500 text-white shadow-lg hover:shadow-purple-500/30",
    secondary:
      "bg-white/5 hover:bg-white/10 text-white border border-white/20 hover:border-white/30",
    ghost: "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10",
  };

  const sizeStyles = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const isDisabled = disabled || variant === "ghost";

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}
