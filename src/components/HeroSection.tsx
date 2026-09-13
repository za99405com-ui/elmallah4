import React from 'react';
import { ArrowLeft, Sparkles, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const HeroSection: React.FC = () => {
  const { setActiveTab } = useStore();

  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 sm:p-10 lg:p-14 border border-slate-800 shadow-sm mb-10">
      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
        
        {/* Clean Minimal Badge */}
        <div className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700/80 px-3.5 py-1.5 rounded-full text-slate-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>طلب وتوصيل الأسماك الطازجة في مصر</span>
        </div>

        {/* Big Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight sm:leading-tight text-white">
          اختار سمكك.. <br className="sm:hidden" />
          <span className="text-cyan-400">
            وإحنا نوصلّه لحد بابك 🐟
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-300 font-normal max-w-2xl mx-auto leading-relaxed">
          سمك بحري ونيللي طازج صيد اليوم. بننظف ونجهز ونتبل حسب رغبتك ونوصله مبرد في أسرع وقت.
        </p>

        {/* Call-To-Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setActiveTab('products')}
            id="hero-start-order-btn"
            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-slate-950 font-bold text-lg rounded-2xl shadow-xs hover:scale-102 active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            <span>ابدأ الطلب الآن</span>
            <span>🐟</span>
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Feature Badges - Minimal Grid */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-right sm:text-center">
          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/60 flex items-center gap-3">
            <span className="text-2xl">🌊</span>
            <div>
              <h4 className="font-bold text-xs text-white">طازة يومياً</h4>
              <p className="text-[11px] text-slate-400">من البحر للمطبخ</p>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/60 flex items-center gap-3">
            <span className="text-2xl">🔪</span>
            <div>
              <h4 className="font-bold text-xs text-white">تنظيف مجاني</h4>
              <p className="text-[11px] text-slate-400">سنجاري / مشوي / مقلي</p>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/60 flex items-center gap-3">
            <span className="text-2xl">🚚</span>
            <div>
              <h4 className="font-bold text-xs text-white">توصيل مبرد</h4>
              <p className="text-[11px] text-slate-400">خلال 60 دقيقة</p>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/60 flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <h4 className="font-bold text-xs text-white">دفع عند الاستلام</h4>
              <p className="text-[11px] text-slate-400">معاينة قبل الدفع</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

