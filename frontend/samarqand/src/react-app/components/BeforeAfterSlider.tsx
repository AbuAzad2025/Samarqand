import { useId, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface BeforeAfterProps {
  before: string;
  after: string;
  title: string;
  /** Describes the pictured work, so the two images have meaningful alt text. */
  description?: string;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function BeforeAfterSlider({ before, after, title, description }: BeforeAfterProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  // Unique per instance: several sliders can share a page without clashing ids.
  const labelId = useId();
  const hintId = useId();

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
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setSliderPosition((prev) => clamp(prev - step));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSliderPosition((prev) => clamp(prev + step));
        break;
      case 'PageDown':
        e.preventDefault();
        setSliderPosition((prev) => clamp(prev - 10));
        break;
      case 'PageUp':
        e.preventDefault();
        setSliderPosition((prev) => clamp(prev + 10));
        break;
      case 'Home':
        e.preventDefault();
        setSliderPosition(0);
        break;
      case 'End':
        e.preventDefault();
        setSliderPosition(100);
        break;
      default:
        break;
    }
  };

  // The rounded value drives both the visual divider and the ARIA state so they agree.
  const position = Math.round(sliderPosition);
  const beforeAlt = description
    ? `قبل التجديد: ${title} — ${description}`
    : `قبل التجديد: ${title}`;
  const afterAlt = description
    ? `بعد التجديد: ${title} — ${description}`
    : `بعد التجديد: ${title}`;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-xl">
      <h3 id={labelId} className="bg-[var(--corp-dark)] p-4 text-center text-lg font-bold text-white sm:p-6 sm:text-2xl">
        {title}
      </h3>
      <p id={hintId} className="sr-only">
        مقارنة قبل وبعد. استخدم الأسهم اليسار واليمين لتحريك خط الفصل، أو اسحب المقبض بالفأرة أو اللمس.
      </p>

      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={position}
        aria-valuetext={`نسبة الظهور: قبل ${position}٪، بعد ${100 - position}٪`}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="relative h-64 w-full cursor-ew-resize touch-none select-none rounded-b-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sq-green sm:h-80 lg:h-96"
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
          alt={afterAlt}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Before image with clip */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            loading="lazy"
            decoding="async"
            src={before}
            alt={beforeAlt}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Slider line and handle */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1 bg-white shadow-2xl"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
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
