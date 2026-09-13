import React from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCategory } from '../types';
import { STORE_CATEGORIES } from '../data/initialData';

export const CategoryList: React.FC = () => {
  const { selectedCategory, setSelectedCategory, setActiveTab } = useStore();

  const handleCategoryClick = (catId: ProductCategory | 'all') => {
    setSelectedCategory(catId);
    setActiveTab('products');
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>أقسام الأسماك الطازجة</span>
            <span className="text-slate-500 text-xs font-normal">اختر قسمك المفضل</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">اضغط على أي قسم لعرض منتجاته فوراً</p>
        </div>

        <button
          onClick={() => handleCategoryClick('all')}
          className="text-cyan-800 dark:text-cyan-400 hover:text-cyan-950 font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          عرض الكل ➔
        </button>
      </div>

      {/* Grid of Large Category Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STORE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              id={`cat-card-${cat.id}`}
              className={`relative overflow-hidden rounded-2xl p-3 text-center transition-all duration-200 flex flex-col items-center justify-between gap-2.5 group cursor-pointer border ${
                isSelected
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-2xs border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 shadow-2xs'
              }`}
            >
              {/* Category Image */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden relative border border-slate-100 dark:border-slate-800">
                <img
                  src={cat.image}
                  alt={cat.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute bottom-0.5 right-0.5 text-lg filter drop-shadow-xs">
                  {cat.emoji}
                </div>
              </div>

              {/* Title */}
              <div className="w-full">
                <h3 className={`font-bold text-xs sm:text-sm leading-tight ${isSelected ? 'text-white dark:text-slate-950' : 'text-slate-900 dark:text-white'}`}>
                  {cat.name}
                </h3>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
