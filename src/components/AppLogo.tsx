import logoImg from '../assets/images/lifetracko_logo_1789293094361.jpg';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export function AppLogo({
  size = 'md',
  showText = true,
  subtitle,
  className = '',
  onClick,
}: AppLogoProps) {
  const containerSizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
    xl: 'w-16 h-16 rounded-2xl',
  };

  const fontSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const beaconSizes = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-2xl',
  };

  return (
    <div
      onClick={onClick}
      className={`group/lifetracko inline-flex items-center gap-3 select-none transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
      } ${className}`}
    >
      {/* Logo Icon Container with Multi-Layer Glow, Float & Specular Gleam */}
      <div className="relative shrink-0 lifetracko-logo-container">
        {/* Ambient Radial Backlight Glow (breathing pulse aura) */}
        <div
          className={`absolute -inset-1.5 ${beaconSizes[size]} lifetracko-logo-glow -z-10 opacity-70 group-hover/lifetracko:opacity-100 transition-opacity duration-500`}
        />

        {/* Vital Beacon Pulse Ring radiating outwards */}
        <div
          className={`absolute inset-0 ${beaconSizes[size]} border border-emerald-400/50 lifetracko-beacon pointer-events-none`}
        />

        {/* Dynamic Holographic Gradient Border Ring */}
        <div
          className={`${containerSizes[size]} p-[1.5px] bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 shadow-lg shadow-emerald-500/25 group-hover/lifetracko:shadow-xl group-hover/lifetracko:shadow-emerald-500/40 transition-all duration-300 relative`}
        >
          {/* Inner Image Container with Glass Specular Sweep */}
          <div
            className={`w-full h-full ${beaconSizes[size]} overflow-hidden bg-slate-900 flex items-center justify-center relative lifetracko-specular-sweep`}
          >
            <img
              src={logoImg}
              alt="LifeTracko Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center group-hover/lifetracko:scale-110 group-hover/lifetracko:rotate-1 transition-transform duration-500 ease-out"
            />

            {/* Subtle inner ambient ring */}
            <div className="absolute inset-0 rounded-inherit ring-1 ring-inset ring-white/10 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Brand Typography & Effects */}
      {showText && (
        <div className="flex flex-col">
          <div className="lifetracko-text-wrapper flex items-center">
            <span
              className={`font-black ${fontSizes[size]} tracking-tight text-slate-900 dark:text-white leading-none drop-shadow-sm group-hover/lifetracko:text-slate-800 dark:group-hover/lifetracko:text-slate-100 transition-colors`}
            >
              Life
            </span>
            <span
              className={`font-black ${fontSizes[size]} tracking-tight leading-none lifetracko-title-gradient drop-shadow-[0_2px_10px_rgba(16,185,129,0.35)]`}
            >
              Tracko
            </span>

            {/* Specular Gleam Sweep across the text */}
            <div className="lifetracko-text-shimmer-layer" />
          </div>

          {/* Subtitle */}
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-tight mt-1 flex items-center group-hover/lifetracko:text-emerald-600 dark:group-hover/lifetracko:text-emerald-400 transition-colors">
            {subtitle || 'Smart Nutrition & Expense Management'}
          </span>
        </div>
      )}
    </div>
  );
}
