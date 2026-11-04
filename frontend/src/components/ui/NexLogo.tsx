import React from 'react';

interface NexLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'inverted'; // 'inverted' for dark navy backgrounds
  subtitle?: string;
}

export const NexLogoMark: React.FC<{ className?: string; inverted?: boolean }> = ({
  className = 'w-9 h-9',
  inverted = false,
}) => {
  const navyColor = inverted ? '#FFFFFF' : '#0F2547';
  const tealColor = '#3596B0';

  return (
    <svg
      viewBox="0 0 120 106"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NexCRM Logo Mark"
    >
      {/* Left L-shaped Navy stem */}
      <path d="M12 24 H32 V86 H47 V102 H12 Z" fill={navyColor} />
      {/* Center Diagonal Navy N-stroke */}
      <path d="M32 6 H60 L98 86 H112 V102 H84 L46 24 H32 Z" fill={navyColor} />
      {/* Top Right Teal Square Dot */}
      <rect x="98" y="6" width="20" height="20" fill={tealColor} />
      {/* Right Teal Vertical Bar */}
      <rect x="98" y="34" width="20" height="52" fill={tealColor} />
    </svg>
  );
};

export const NexBrandLockup: React.FC<NexLogoProps> = ({
  size = 'md',
  variant = 'default',
  subtitle = 'INTELLIGENCE BEYOND DATA',
}) => {
  const isInverted = variant === 'inverted';

  const markSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const subSizes = {
    sm: 'text-[8px] tracking-[0.22em]',
    md: 'text-[9px] tracking-[0.25em]',
    lg: 'text-[10px] tracking-[0.28em]',
  };

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <div
        className={`rounded-xl flex items-center justify-center shrink-0 ${
          isInverted
            ? 'bg-white p-1.5 shadow-md shadow-black/20'
            : 'bg-white dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700 shadow-xs'
        }`}
      >
        <img
          src="/logo-mark.webp"
          alt="NexInt AI Logo"
          className={`${markSizes[size]} object-contain`}
        />
      </div>

      <div className="flex flex-col">
        <div className={`${titleSizes[size]} font-extrabold tracking-tight leading-none flex items-center`}>
          <span
            className={
              isInverted
                ? 'text-white'
                : 'text-[#0F2547] dark:text-white'
            }
          >
            Nex
          </span>
          <span className="text-[#3596B0]">CRM</span>
        </div>
        {subtitle && (
          <div
            className={`${subSizes[size]} font-semibold uppercase mt-1 ${
              isInverted
                ? 'text-[#3596B0]'
                : 'text-[#0F2547]/80 dark:text-[#3596B0]'
            }`}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

