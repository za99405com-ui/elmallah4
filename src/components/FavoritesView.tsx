import React from 'react';
import { Heart, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';

export const FavoritesView: React.FC = React.memo(() => {
  const { products, favorites, setActiveTab } = useStore();

  const favoriteProducts = React.useMemo(() => {
    return products.filter((p) => favorites.includes(p.id));
  }, [products, favorites]);

  return (
    <div className="max-w-7xl mx-auto py-3 px-3 sm:px-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>الأسماك المفضلة</span>
            <span className="text-rose-500">❤️</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">
            الأنواع التي قمت بحفظها لطلبها بسرعة وسهولة في أي وقت
          </p>
        </div>

        <button
          onClick={() => setActiveTab('products')}
          className="text-slate-800 dark:text-slate-200 hover:text-slate-950 font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          تصفح كل الأسماك ➔
        </button>
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 max-w-sm mx-auto">
          <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 rounded-full flex items-center justify-center mx-auto text-rose-500">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">قائمتك المفضلة فارغة</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            اضغط على علامة القلب ❤️ على أي سمكة لإضافتها هنا والوصول إليها بسرعة!
          </p>
          <button
            onClick={() => setActiveTab('products')}
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            استكشف الأسماك الآن 🐟
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {favoriteProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
});
