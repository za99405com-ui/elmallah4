import React, { useState, useMemo, useTransition, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';
import { DeliveryCutoffBanner } from '../components/DeliveryCutoffBanner';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { SearchModal } from '../components/SearchModal';
import { CheckoutFlow } from '../components/CheckoutFlow';
import { OrdersTracker } from '../components/OrdersTracker';
import { FavoritesView } from '../components/FavoritesView';
import { SettingsView } from '../components/SettingsView';
import { AboutPage, DeliveryPolicyPage, ContactPage } from '../components/InfoPages';
import { Footer } from '../components/Footer';
import { STORE_CATEGORIES } from '../data/initialData';
import { 
  MessageCircle, 
  ShoppingCart
} from 'lucide-react';
import { Product, ProductCategory } from '../types';
import { getWhatsAppLink } from '../utils/whatsapp';

/* -------------------------------------------------------------------------- */
/* Subcomponent: Products Catalog View (Customer Store)                       */
/* -------------------------------------------------------------------------- */
interface ProductsCatalogViewProps {
  visibleProducts: Product[];
  selectedCategory: ProductCategory | 'all';
  onSelectCategory: (cat: ProductCategory | 'all') => void;
}

const ProductsCatalogView = React.memo<ProductsCatalogViewProps>(({
  visibleProducts,
  selectedCategory,
  onSelectCategory
}) => {
  const { isLoadingData, loadDirectFromSupabase } = useStore();
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return visibleProducts;
    }

    return visibleProducts.filter(
      (product) => product.category === selectedCategory
    );
  }, [visibleProducts, selectedCategory]);

  const handleResetFilters = useCallback(() => {
    onSelectCategory('all');
  }, [onSelectCategory]);

  return (
    <div className="space-y-4">
      {/* Categories only — products start immediately below */}
      <div className="w-full overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-2xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            🐟 كل الأسماك ({visibleProducts.length})
          </button>

          {STORE_CATEGORIES.map((cat) => {
            const count = visibleProducts.filter(
              (product) => product.category === cat.id
            ).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <span>{cat.emoji}</span>
                <span className="mr-1">{cat.name}</span>
                <span className="text-[10px] opacity-70 mr-1">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Products or Skeleton / Empty */}
      {isLoadingData && visibleProducts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
              <div className="w-full aspect-4/3 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2" />
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 space-y-4">
          <span className="text-4xl block">🐟</span>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            {visibleProducts.length === 0 ? 'قائمة صيد اليوم قيد التحديث' : 'لا توجد منتجات في هذا التصنيف حالياً'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {visibleProducts.length === 0 
              ? 'يتم تحديث تشكيلة الأسماك والمأكولات البحرية الطازجة حالياً. يمكنكم أيضاً التواصل معنا مباشرة عبر واتساب للاستفسار وحجز طلبكم.'
              : 'اختر تصنيفاً آخر أو اعرض كل المنتجات'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {visibleProducts.length === 0 ? (
              <>
                <a
                  href={getWhatsAppLink('مرحباً متجر الملاح، أود الاستفسار عن الأسماك المتوفرة اليوم للحجز والطلب.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل عبر واتساب</span>
                </a>
                <button
                  onClick={loadDirectFromSupabase}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  تحديث القائمة 🔄
                </button>
              </>
            ) : (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                عرض كل الأسماك
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
});
ProductsCatalogView.displayName = 'ProductsCatalogView';

/* -------------------------------------------------------------------------- */
/* Subcomponent: Floating Action Buttons (WhatsApp & Cart)                     */
/* -------------------------------------------------------------------------- */
interface FloatingActionButtonsProps {
  whatsappNumber: string;
  cartCount: number;
  activeTab: string;
  onOpenCart: () => void;
}

const FloatingActionButtons = React.memo<FloatingActionButtonsProps>(({
  whatsappNumber,
  cartCount,
  activeTab,
  onOpenCart
}) => {
  return (
    <div className="fixed bottom-16 sm:bottom-6 left-4 z-40 flex flex-col items-center gap-2">
      {/* WhatsApp Quick Chat */}
      <a
        href={getWhatsAppLink(whatsappNumber, 'مرحباً متجر الملاح، أود الاستفسار عن الأسماك المتوفرة اليوم')}
        target="_blank"
        rel="noreferrer"
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        title="تواصل معنا واتساب"
      >
        <MessageCircle className="w-6 h-6" />
      </a>

      {/* Floating Cart Button */}
      {cartCount > 0 && activeTab !== 'cart' && (
        <button
          onClick={onOpenCart}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all relative cursor-pointer"
          title="إتمام الطلب"
        >
          <ShoppingCart className="w-5 h-5 text-cyan-400 dark:text-cyan-600" />
          <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
            {cartCount}
          </span>
        </button>
      )}
    </div>
  );
});
FloatingActionButtons.displayName = 'FloatingActionButtons';

/* -------------------------------------------------------------------------- */
/* Customer Store Main View                                                   */
/* -------------------------------------------------------------------------- */
export const CustomerStoreApp: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    visibleProducts,
    selectedCategory, 
    setSelectedCategory,
    cartCount,
    storeSettings
  } = useStore();

  const [isPending, startTransition] = useTransition();

  const handleOpenCart = useCallback(() => {
    startTransition(() => {
      setActiveTab('cart');
    });
  }, [setActiveTab]);

  const handleSelectCategory = useCallback((cat: ProductCategory | 'all') => {
    startTransition(() => {
      setSelectedCategory(cat);
    });
  }, [setSelectedCategory]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white transition-colors" dir="rtl">
      
      {/* Top Navbar */}
      <Navbar />

      {/* Non-blocking transition loading line indicator */}
      {isPending && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 z-50 animate-pulse" />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        
        {/* Delivery Cut-off Banner (Shown on main catalog and cart) */}
        {(activeTab === 'products' || activeTab === 'cart') && (
          <DeliveryCutoffBanner />
        )}

        {/* VIEW 1: PRODUCTS CATALOG (Default Store View) */}
        {activeTab === 'products' && (
          <ProductsCatalogView
            visibleProducts={visibleProducts}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {/* VIEW 2: CART & 3-STEP CHECKOUT */}
        {activeTab === 'cart' && <CheckoutFlow />}

        {/* VIEW 3: ORDERS TRACKER (Current Device Only) */}
        {activeTab === 'orders' && <OrdersTracker />}

        {/* VIEW 4: FAVORITES */}
        {activeTab === 'favorites' && <FavoritesView />}

        {/* VIEW 5: SETTINGS & USER ACCOUNT */}
        {activeTab === 'settings' && <SettingsView />}

        {/* VIEW 6: ABOUT PAGE */}
        {activeTab === 'about' && <AboutPage />}

        {/* VIEW 7: DELIVERY POLICY */}
        {activeTab === 'delivery' && <DeliveryPolicyPage />}

        {/* VIEW 8: CONTACT US */}
        {activeTab === 'contact' && <ContactPage />}

      </main>

      {/* Floating WhatsApp & Floating Cart Button */}
      <FloatingActionButtons
        whatsappNumber={storeSettings.whatsappNumber}
        cartCount={cartCount}
        activeTab={activeTab}
        onOpenCart={handleOpenCart}
      />

      {/* Global Modals */}
      <SearchModal />
      <ProductDetailModal />

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
