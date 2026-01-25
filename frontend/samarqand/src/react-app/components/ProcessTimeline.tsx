import { CheckCircle, FileSearch, HardHat, PenTool } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

export default function ProcessTimeline() {
  const [steps, setSteps] = useState<
    { id: number; title: string; description: string }[]
  >([]);

  useEffect(() => {
    fetchHomeSections()
      .then((data) => setSteps(data.timelineSteps))
      .catch(() => {});
  }, []);

  const icons = useMemo(() => [FileSearch, PenTool, HardHat, CheckCircle], []);
  const colors = useMemo(
    () => [
      "from-blue-500 to-blue-600",
      "from-purple-500 to-purple-600",
      "from-orange-500 to-orange-600",
      "from-green-500 to-green-600",
    ],
    [],
  );

  return (
    <section className="py-20 bg-white" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            كيف نعمل
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            عملية واضحة وشفافة من البداية حتى النهاية
          </p>
        </div>

        <div className="relative">
          {/* Timeline Line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-[#4A90E2] via-purple-500 via-orange-500 to-green-500 transform -translate-y-1/2" />

          <div className="grid md:grid-cols-4 gap-8 relative">
            {steps.map((step, index) => {
              const Icon = icons[index % icons.length] ?? FileSearch;
              const color = colors[index % colors.length] ?? colors[0]!;
              return (
              <div key={index} className="relative">
                {/* Step Card */}
                <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-gray-100">
                  {/* Icon */}
                  <div className={`w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shadow-lg relative z-10`}>
                    <Icon className="text-white" size={36} />
                  </div>

                  {/* Number Badge */}
                  <div className="absolute -top-4 -right-4 w-10 h-10 bg-gradient-to-br from-[#4A90E2] to-[#5DADE2] rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                    {index + 1}
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-800 mb-3 text-center">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 text-center text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Connector Arrow (mobile only) */}
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-4">
                    <div className="w-1 h-8 bg-gradient-to-b from-[#4A90E2] to-[#5DADE2]" />
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      </div>
    </section>
  );
}
