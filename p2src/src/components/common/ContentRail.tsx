import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ContentRailProps {
  title: string;
  subtitle?: string;
  onViewAll?: () => void;
  children: React.ReactNode;
}

export const ContentRail: React.FC<ContentRailProps> = ({
  title,
  subtitle,
  onViewAll,
  children,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -420 : 420;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative py-4 md:py-6 group/rail">
      {/* Rail Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3.5 flex items-end justify-between">
        <div>
          <h2 className="text-lg md:text-[22px] font-bold text-white tracking-tight font-display flex items-center gap-2.5">
            <span className="w-1 h-5 rounded-full bg-gradient-to-b from-[#E5093A] to-[#C0157F]" aria-hidden="true" />
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#8993A3] mt-1 pl-3.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs font-semibold text-[#8993A3] hover:text-[#FF2E55] transition-colors duration-200 mr-2"
            >
              View All
            </button>
          )}
          {/* Scroll Navigation Chevrons (Desktop) */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-full bg-[#111A27]/90 hover:bg-[#18202C] text-[#C6CBD4] hover:text-white border border-white/[0.07] transition-all duration-200 focus:outline-none"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-full bg-[#111A27]/90 hover:bg-[#18202C] text-[#C6CBD4] hover:text-white border border-white/[0.07] transition-all duration-200 focus:outline-none"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth px-4 sm:px-6 lg:px-8 py-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {children}
      </div>
    </section>
  );
};
