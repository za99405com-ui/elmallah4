import React from 'react';
import { ShoppingCart, Search, Fish, MessageCircle, Heart, Settings, Clock, Moon, Sun } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getWhatsAppLink } from '../utils/whatsapp';

export const Navbar: React.FC = React.memo(() => {
  const { 
    activeTab, 
    setActiveTab, 
    cartCount, 
    setIsSearchOpen, 
    favorites, 
    orders,
    cutoffInfo,
    theme,
    toggleTheme,
    storeSettings
  } = useStore();

  const activeOrdersCount = orders.filter(
    (o) => o.status === 'new' || o.status === 'preparing' || o.status === 'on_delivery'
  ).length;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs transition-all">
      
      {/* Top Announcement Bar */}
      <div className="bg-slate-900 dark:bg-slate-950 text-slate-200 py-1 px-4 text-xs font-medium border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold text-[11px] sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              أسماك طازجة صيد اليوم 100% 🐟
            </span>
            <span className="hidden md:inline-block text-slate-700">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-300 text-xs">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>إغلاق طلبات اليوم {cutoffInfo.cutoffTimeString}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <a 
              href={getWhatsAppLink(storeSettings.whatsappNumber, 'مرحباً متجر الملاح، أحتاج مساعدة أو استفسار')}
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-2.5 py-0.5 rounded-lg text-white text-[11px] sm:text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              title="مساعدة عبر واتساب"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>واتساب للمساعدة</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Brand Logo */}
          <button
            onClick={() => setActiveTab('products')}
            className="flex items-center gap-2.5 text-right group focus:outline-hidden cursor-pointer"
            id="brand-logo-btn"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Fish className="w-6 h-6 text-cyan-400 dark:text-cyan-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">المَـلّاح</span>
                <span className="bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">طازة</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">أسماك طازجة صيد اليوم</p>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🐟</span>
              <span>الأسماك الطازجة</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>📦</span>
              <span>تتبع الطلب</span>
              {activeOrdersCount > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 rounded-full font-bold">
                  {activeOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>المفضلة ({favorites.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>حسابي والإعدادات</span>
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              id="header-search-btn"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all text-xs font-semibold cursor-pointer"
              title="بحث سريع"
            >
              <Search className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden md:inline">بحث...</span>
            </button>

            {/* Cart Button */}
            <button
              onClick={() => setActiveTab('cart')}
              id="header-cart-btn"
              className="relative flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-cyan-400 dark:text-cyan-600" />
              <span className="hidden sm:inline">السلة</span>
              {cartCount > 0 && (
                <span className="flex items-center justify-center min-w-4 h-4 px-1 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>

          </div>

        </div>
      </div>
    </header>
  );
});
