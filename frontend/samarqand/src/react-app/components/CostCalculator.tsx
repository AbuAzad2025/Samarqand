import { useState } from 'react';
import { Calculator, Home, Ruler, DollarSign } from 'lucide-react';

export default function CostCalculator() {
  const [buildingType, setBuildingType] = useState('residential');
  const [area, setArea] = useState(200);
  const [floors, setFloors] = useState(1);
  const [quality, setQuality] = useState('standard');

  const calculateCost = () => {
    let basePrice = 0;
    
    // Base price per square meter by building type
    switch (buildingType) {
      case 'residential':
        basePrice = 500;
        break;
      case 'commercial':
        basePrice = 700;
        break;
      case 'villa':
        basePrice = 800;
        break;
    }

    // Quality multiplier
    const qualityMultiplier = quality === 'premium' ? 1.5 : quality === 'luxury' ? 2 : 1;

    // Calculate total
    const total = basePrice * area * floors * qualityMultiplier;
    
    return total.toLocaleString('en-US');
  };

  return (
    <section className="py-20 bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126]" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-white/20 rounded-full mb-4">
              <Calculator className="text-white" size={48} />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              احسب تكلفة مشروعك
            </h2>
            <p className="text-white/90 text-lg">
              احصل على تقدير تقريبي لتكلفة مشروعك البناء
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Building Type */}
              <div>
                <label className="flex items-center gap-2 text-gray-700 font-bold mb-3">
                  <Home size={20} className="text-[#007A3D]" />
                  نوع المبنى
                </label>
                <select
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#007A3D] focus:outline-none transition"
                >
                  <option value="residential">سكني</option>
                  <option value="commercial">تجاري</option>
                  <option value="villa">فيلا</option>
                </select>
              </div>

              {/* Quality */}
              <div>
                <label className="flex items-center gap-2 text-gray-700 font-bold mb-3">
                  <DollarSign size={20} className="text-[#007A3D]" />
                  مستوى التشطيب
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[#007A3D] focus:outline-none transition"
                >
                  <option value="standard">عادي</option>
                  <option value="premium">ممتاز</option>
                  <option value="luxury">فاخر</option>
                </select>
              </div>

              {/* Area */}
              <div>
                <label className="flex items-center gap-2 text-gray-700 font-bold mb-3">
                  <Ruler size={20} className="text-[#007A3D]" />
                  المساحة (م²): {area}
                </label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="10"
                  value={area}
                  onChange={(e) => setArea(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#007A3D]"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>50 م²</span>
                  <span>1000 م²</span>
                </div>
              </div>

              {/* Floors */}
              <div>
                <label className="flex items-center gap-2 text-gray-700 font-bold mb-3">
                  عدد الطوابق: {floors}
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={floors}
                  onChange={(e) => setFloors(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#007A3D]"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>طابق واحد</span>
                  <span>5 طوابق</span>
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126] rounded-xl p-8 text-center">
              <p className="text-white/90 text-lg mb-2">التكلفة التقريبية</p>
              <p className="text-5xl font-bold text-white mb-2">${calculateCost()}</p>
              <p className="text-white/80 text-sm mb-6">* هذا تقدير أولي وقد يختلف السعر النهائي</p>
              
              <a
                href={`https://wa.me/970569953362?text=${encodeURIComponent(`مرحباً، أريد استشارة عن مشروع ${buildingType === 'residential' ? 'سكني' : buildingType === 'commercial' ? 'تجاري' : 'فيلا'} بمساحة ${area} م² و ${floors} طوابق`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white text-[#007A3D] px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition"
              >
                احصل على عرض سعر دقيق
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
