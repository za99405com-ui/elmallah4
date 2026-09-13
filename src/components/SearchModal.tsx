import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Search, X, ShoppingCart } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const POPULAR_SEARCH_TERMS = [
  'بلطي',
  'جمبري',
  'بوري',
  'دنيس',
  'قاروص',
  'سالمون',
  'وقار',
  'فيليه'
];

export const SearchModal: React.FC = () => {
  const { 
    isSearchOpen, 
    setIsSearchOpen, 
    visibleProducts,
    addToCart,
    setSelectedProductForModal
  } = useStore();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return visibleProducts;
    const q = searchQuery.trim().toLowerCase();
    return visibleProducts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q)
    );
  }, [visibleProducts, searchQuery]);

  if (!isSearchOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={() => setIsSearchOpen(false)}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 mt-4 sm:mt-12 text-right animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        id="search-dialog"
      >
        {/* Search Input Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>البحث في الأسماك الطازجة</span>
              <span className="text-sm">🐟</span>
            </h3>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب اسم السمك (بلطي، جمبري، بوري...)"
              className="w-full px-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Keywords Chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            <span className="text-[11px] font-medium text-slate-400">شائع:</span>
            {POPULAR_SEARCH_TERMS.map((term) => (
              <button
                key={term}
                onClick={() => setSearchQuery(term)}
                className={`text-[11px] px-2 py-0.5 rounded-lg font-medium transition-all cursor-pointer ${
                  searchQuery === term
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Live Search Results */}
        <div className="p-3 sm:p-4 max-h-[55vh] overflow-y-auto space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span>نتائج البحث ({filtered.length})</span>
            {searchQuery && <span>البحث عن: "{searchQuery}"</span>}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <span className="text-3xl block">🐠</span>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">لم نجد أصناف مطابقة</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                جرب البحث بكلمات أخرى مثل: بلطي، جمبري، بوري، دنيس.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-3.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-lg text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                عرض كل الأصناف
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    setSelectedProductForModal(product);
                    setIsSearchOpen(false);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={product.image}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-lg object-cover border border-slate-100 dark:border-slate-700"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{product.description}</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-slate-900 dark:text-white font-bold text-xs">{product.price} جنيه</span>
                        <span className="text-slate-400 text-[10px]">/ {product.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product, 1);
                      }}
                      className="px-2.5 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>إضافة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 text-center text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
          أسماك طازجة صيد اليوم مبردة
        </div>
      </div>
    </div>
  );
};
