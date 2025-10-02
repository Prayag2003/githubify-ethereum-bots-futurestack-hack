import { InputProps } from "@/types";

/**
 * Reusable Input component following KISS principle
 * Single responsibility: Handle input rendering and styling
 */
export function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  onKeyPress,
  size = "default",
}: InputProps & {
  onKeyPress?: (e: React.KeyboardEvent) => void;
  size?: "default" | "sm" | "lg";
}) {
  const sizeStyles = {
    sm: "px-4 py-2 text-sm",
    default: "px-6 py-4 text-lg",
    lg: "px-8 py-6 text-xl",
  };

  const textAlign = className.includes("text-left")
    ? "text-left"
    : "text-center";

  return (
    <div className={`relative w-full ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={onKeyPress}
        disabled={disabled}
        className={`w-full ${sizeStyles[size]} bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all duration-500 backdrop-blur-sm ${textAlign} font-light`}
      />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </div>
  );
}
