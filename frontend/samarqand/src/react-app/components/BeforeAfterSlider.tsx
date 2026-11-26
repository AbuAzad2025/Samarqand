import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface BeforeAfterProps {
  before: string;
  after: string;
  title: string;
}

export default function BeforeAfterSlider({ before, after, title }: BeforeAfterProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleMove(e.clientX, rect);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleMove(e.touches[0].clientX, rect);
  };

  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden">
      <h3 className="text-2xl font-bold text-gray-800 p-6 text-center bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white">
        {title}
      </h3>
      
      <div
        className="relative h-96 select-none cursor-ew-resize"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onTouchMove={handleTouchMove}
      >
        {/* After Image */}
        <img
          src={after}
          alt="بعد"
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Before Image with Clip */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            src={before}
            alt="قبل"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Slider Line */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl"
          style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center">
            <MoveHorizontal className="text-[#007A3D]" size={24} />
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm font-bold backdrop-blur-sm">
          بعد
        </div>
        <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm font-bold backdrop-blur-sm">
          قبل
        </div>
      </div>
    </div>
  );
}
