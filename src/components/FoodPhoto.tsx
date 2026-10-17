import React, { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

export const FoodPhoto: React.FC<{ src: string | null; alt: string; className?: string }> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={`relative grid place-items-center overflow-hidden bg-[#123B2A]/5 ${className}`}>
    {src && !failed ? <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)}/> : <div className="flex flex-col items-center gap-2 text-[#123B2A]/45" aria-label="Food photo unavailable"><UtensilsCrossed className="h-8 w-8" aria-hidden="true"/><span className="text-[10px] font-semibold uppercase tracking-[.12em]">wá jẹun</span></div>}
  </div>;
};
