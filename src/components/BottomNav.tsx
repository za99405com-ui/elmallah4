import React from 'react';
import { Fish, ShoppingCart, Package, Heart, Settings } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const BottomNav: React.FC = React.memo(() => {
  const { activeTab, setActiveTab, cartCount, orders, favorites } = useStore();

  const activeOrdersCount = orders.filter(
    (o) => o.status === 'new' || o.status === 'preparing' || o.status === 'on_delivery'
  ).length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-1 px-2 lg:hidden">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5">
        
        {/* Tab 1: Products Catalog (Home) */}
        <button
          onClick={() => setActiveTab('products')}
          id="bottom-nav-products"
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'products' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}>
            <Fish className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </button>

        {/* Tab 2: Orders */}
        <button
          onClick={() => setActiveTab('orders')}
          id="bottom-nav-orders"
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'orders'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg relative ${activeTab === 'orders' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}>
            <Package className="w-4 h-4" />
            {activeOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {activeOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">طلباتي</span>
        </button>

        {/* Tab 3: Cart */}
        <button
          onClick={() => setActiveTab('cart')}
          id="bottom-nav-cart"
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'cart'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg relative ${activeTab === 'cart' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}>
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">السلة</span>
        </button>

        {/* Tab 4: Favorites */}
        <button
          onClick={() => setActiveTab('favorites')}
          id="bottom-nav-favorites"
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'favorites'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg relative ${activeTab === 'favorites' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}>
            <Heart className="w-4 h-4" />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">المفضلة</span>
        </button>

        {/* Tab 5: Settings / Account */}
        <button
          onClick={() => setActiveTab('settings')}
          id="bottom-nav-settings"
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'settings' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''}`}>
            <Settings className="w-4 h-4" />
          </div>
          <span className="text-[10px] mt-0.5">حسابي</span>
        </button>

      </div>
    </div>
  );
});
