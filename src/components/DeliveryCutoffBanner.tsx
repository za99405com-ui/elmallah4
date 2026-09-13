import React from 'react';
import { Clock, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const DeliveryCutoffBanner: React.FC = React.memo(() => {
  const { cutoffInfo } = useStore();

  return (
    <div 
      id="delivery-cutoff-banner"
      className={`rounded-2xl p-3 sm:p-4 mb-3 border transition-all duration-200 shadow-2xs ${
        cutoffInfo.isBeforeCutoff
          ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-100'
          : 'bg-amber-50/90 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-100'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        
        {/* Main message & icon */}
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            cutoffInfo.isBeforeCutoff
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-600 text-white'
          }`}>
            <Clock className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                cutoffInfo.isBeforeCutoff
                  ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
              }`}>
                {cutoffInfo.badgeLabel}
              </span>

              <span className="text-xs sm:text-sm font-bold">
                آخر موعد لاستقبال طلبات اليوم: {cutoffInfo.cutoffTimeString}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {cutoffInfo.isBeforeCutoff ? (
                <>
                  اطلب الآن واستلم طازج <strong className="text-emerald-700 dark:text-emerald-300">{cutoffInfo.deliveryDateLabel}</strong> مباشرة من صيد الفجر.
                </>
              ) : (
                <>
                  تجاوزنا موعد 3:00 فجراً — طلبك الآن سيتم تسليمه طازجاً <strong className="text-amber-700 dark:text-amber-300">{cutoffInfo.deliveryDateLabel}</strong>.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action badge */}
        <div className="w-full sm:w-auto flex items-center justify-end">
          <div className="inline-flex items-center gap-1 text-[11px] font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <Truck className="w-3.5 h-3.5 text-cyan-600" />
            <span>توصيل مبرد طازج 100% 🐟</span>
          </div>
        </div>

      </div>
    </div>
  );
});
