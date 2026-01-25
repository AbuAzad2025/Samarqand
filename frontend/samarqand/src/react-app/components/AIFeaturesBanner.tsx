import { Brain, Sparkles, Zap, MessageSquare, FileText, BarChart } from 'lucide-react';
import { useEffect, useMemo, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

export default function AIFeaturesBanner() {
  const [features, setFeatures] = useState<
    { id: number; title: string; description: string; badgeText: string }[]
  >([]);
  const [metrics, setMetrics] = useState<{ id: number; value: string; label: string }[]>(
    [],
  );

  useEffect(() => {
    fetchHomeSections()
      .then((data) => {
        setFeatures(data.aiFeatures);
        setMetrics(data.aiMetrics);
      })
      .catch(() => {});
  }, []);

  const icons = useMemo(
    () => [MessageSquare, Brain, FileText, Zap, BarChart, Sparkles],
    [],
  );
  const gradients = useMemo(
    () => [
      "from-blue-500 to-cyan-500",
      "from-purple-500 to-pink-500",
      "from-indigo-500 to-purple-500",
      "from-yellow-500 to-orange-500",
      "from-green-500 to-emerald-500",
      "from-pink-500 to-rose-500",
    ],
    [],
  );

  return (
    <section className="py-16 bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${5 + Math.random() * 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10" dir="rtl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-6 py-2 rounded-full mb-6">
            <Brain className="text-purple-400" size={24} />
            <span className="text-white font-bold">مدعوم بالذكاء الاصطناعي</span>
            <Sparkles className="text-yellow-400" size={24} />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            تكنولوجيا الغد، اليوم
          </h2>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            نستخدم أحدث تقنيات الذكاء الاصطناعي لتقديم تجربة استثنائية
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6">
          {features.slice(0, 6).map((feature, index) => {
            const Icon = icons[index % icons.length] ?? Sparkles;
            const gradient = gradients[index % gradients.length] ?? gradients[0]!;
            return (
            <div
              key={feature.id}
              className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {/* Gradient Border */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity`} />
              
              {/* Icon */}
              <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="text-white" size={24} />
              </div>

              {/* Content */}
              <h3 className="text-white font-bold mb-2 text-sm">{feature.title}</h3>
              <p className="text-white/70 text-xs">{feature.description}</p>

              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity -skew-x-12 group-hover:translate-x-full duration-1000" />
            </div>
          )})}
        </div>

        {/* Stats */}
        <div className="mt-16 grid md:grid-cols-4 gap-6">
          {metrics.slice(0, 4).map((stat) => (
            <div key={stat.id} className="text-center">
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                {stat.value}
              </div>
              <div className="text-white/70 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-100px) translateX(50px);
          }
        }
      `}</style>
    </section>
  );
}
