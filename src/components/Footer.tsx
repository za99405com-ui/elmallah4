import React from 'react';
import { Fish, MessageCircle, LayoutDashboard, Clock } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getWhatsAppLink } from '../utils/whatsapp';

export const Footer: React.FC = React.memo(() => {
  const { setActiveTab, cutoffInfo, storeSettings } = useStore();

  return (
    <footer className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 mt-10 pt-8 pb-20 md:pb-8 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Top Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          
          {/* Brand Info */}
          <div className="space-y-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-950 shadow-xs">
                <Fish className="w-4 h-4 text-cyan-400 dark:text-cyan-600" />
              </div>
              <div>
                <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">المَـلّاح</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">أسماك طازجة صيد اليوم</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              متجر متخصص حصرياً في بيع وتوصيل الأسماك البحرية الطازجة صيد اليوم بدون تجميد.
            </p>
            <p className="text-[11px] text-cyan-700 dark:text-cyan-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>إغلاق طلبات اليوم: {cutoffInfo.cutoffTimeString}</span>
            </p>
          </div>

          {/* Quick Shopping Links */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">أقسام المتجر</h4>
            <ul className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li>
                <button
                  onClick={() => {
                    setActiveTab('products');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  🐟 كل الأسماك الطازجة
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveTab('orders');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  📦 تتبع طلباتك
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveTab('favorites');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  ❤️ المفضلة
                </button>
              </li>
            </ul>
          </div>

          {/* Info & Policy Links */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">عن الملاح</h4>
            <ul className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              <li>
                <button
                  onClick={() => {
                    setActiveTab('about');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  من نحن
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveTab('delivery');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  سياسة موعد 3:00 ص والتوصيل
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveTab('contact');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  تواصل معنا
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-slate-800 dark:text-slate-200 hover:text-slate-950 transition-colors cursor-pointer flex items-center gap-1 font-bold"
                >
                  <span>⚙️</span>
                  <span>حسابي والإعدادات</span>
                </button>
              </li>
            </ul>
          </div>

          {/* WhatsApp Direct Contact */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">المساعدة والدعم الفني</h4>
            <div className="space-y-2">
              <a
                href={getWhatsAppLink(storeSettings.whatsappNumber, 'مرحباً متجر الملاح، أحتاج مساعدة أو استفسار')}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-slate-900 dark:text-white hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-2xs group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold block">خدمة العملاء:</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">واتساب للمساعدة</span>
                </div>
              </a>
            </div>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} متجر الملاح للأسماك الطازجة. جميع الحقوق محفوظة.</p>
          <p className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span>طازة صيد اليوم من البحر لباب بيتك</span>
            <span>🐟</span>
          </p>
        </div>

      </div>
    </footer>
  );
});
