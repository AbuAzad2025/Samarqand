import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface BeforeAfterProps {
  before: string;
  after: string;
  title: string;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function BeforeAfterSlider({ before, after, title }: BeforeAfterProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number, rect: DOMRect) => {
    if (!rect.width) return;
    const percentage = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(clamp(percentage));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleMove(e.clientX, e.currentTarget.getBoundingClientRect());
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !e.touches.length) return;
    handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSliderPosition((prev) => clamp(prev - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSliderPosition((prev) => clamp(prev + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSliderPosition(100);
    }
  };

  const position = Math.round(sliderPosition);

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-xl">
      <h3 className="bg-[var(--corp-dark)] p-4 text-center text-lg font-bold text-white sm:p-6 sm:text-2xl">
        {title}
      </h3>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`قبل وبعد: ${title}. اسحب المقبض أو استخدم الأسهم اليسار واليمين`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={position}
        aria-valuetext={`قبل ${position}٪، بعد ${100 - position}٪`}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="relative h-64 w-full cursor-ew-resize touch-none select-none sm:h-80 lg:h-96"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={(e) => {
          setIsDragging(true);
          if (e.touches.length) handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
        }}
        onTouchEnd={() => setIsDragging(false)}
        onTouchMove={handleTouchMove}
      >
        {/* After image */}
        <img
          loading="lazy"
          decoding="async"
          src={after}
          alt={`${title} - بعد`}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Before image with clip */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            loading="lazy"
            decoding="async"
            src={before}
            alt={`${title} - قبل`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Slider line and handle */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1 bg-white shadow-2xl"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-sq-green bg-white shadow-lg ring-2 ring-white/40">
            <MoveHorizontal className="text-sq-green" size={24} aria-hidden="true" />
          </div>
        </div>

        {/* Labels */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm sm:left-4 sm:top-4 sm:px-4 sm:py-2 sm:text-sm"
        >
          قبل
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm sm:right-4 sm:top-4 sm:px-4 sm:py-2 sm:text-sm"
        >
          بعد
        </div>
      </div>
    </div>
  );
}
