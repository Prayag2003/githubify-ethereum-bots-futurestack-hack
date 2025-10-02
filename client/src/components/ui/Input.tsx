import { InputProps } from '@/types'

/**
 * Reusable Input component following KISS principle
 * Single responsibility: Handle input rendering and styling
 */
export function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
}: InputProps) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all duration-500 backdrop-blur-sm text-center text-lg font-light ${className}`}
      />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </div>
  )
}
