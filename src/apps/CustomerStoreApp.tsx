import React, { useEffect, useState, useMemo, useTransition, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';
import { DeliveryCutoffBanner } from '../components/DeliveryCutoffBanner';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { SearchModal } from '../components/SearchModal';
import { CheckoutFlow } from '../components/CheckoutFlow';
import { RealtimePaymentOverlay } from '../components/RealtimePaymentOverlay';
import { OrdersTracker } from '../components/OrdersTracker';
import { FavoritesView } from '../components/FavoritesView';
import { SettingsView } from '../components/SettingsView';
import { AboutPage, DeliveryPolicyPage, ContactPage } from '../components/InfoPages';
import { Footer } from '../components/Footer';
import {
  MessageCircle,
  ShoppingCart,
  ShieldCheck,
  Smartphone,
  Landmark,
} from 'lucide-react';
import { Product, ProductCategory, StoreCategory } from '../types';
import { api, PaymentConfig } from '../utils/api';
import { getWhatsAppLink } from '../utils/whatsapp';

interface ProductsCatalogViewProps {
  visibleProducts: Product[];
  categories: StoreCategory[];
  selectedCategory: ProductCategory | 'all';
  onSelectCategory: (cat: ProductCategory | 'all') => void;
}

const ProductsCatalogView = React.memo<ProductsCatalogViewProps>(({ visibleProducts, categories, selectedCategory, onSelectCategory }) => {
  const { isLoadingData, loadDirectFromSupabase } = useStore();

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return visibleProducts;
    return visibleProducts.filter((product) => product.category === selectedCategory);
  }, [visibleProducts, selectedCategory]);

  return (
    <div className="space-y-3">
      {categories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${selectedCategory === 'all' ? 'bg-white text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-700'}`}
          >
            كل المنتجات
          </button>

          {categories.map((cat) => {
            const value = cat.slug || cat.id;
            const count = visibleProducts.filter((product) => product.category === value).length;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => onSelectCategory(value)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${selectedCategory === value ? 'bg-white text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-700'}`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {isLoadingData && visibleProducts.length === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="aspect-[3/4] bg-slate-200 dark:bg-slate-900 rounded-2xl animate-pulse" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 space-y-3">
          <span className="text-4xl block">🐟</span>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">لا توجد منتجات متاحة حالياً</h3>
          <button onClick={loadDirectFromSupabase} className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl">تحديث المنتجات</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
});
ProductsCatalogView.displayName = 'ProductsCatalogView';

interface FloatingActionButtonsProps {
  whatsappNumber: string;
  cartCount: number;
  activeTab: string;
  onOpenCart: () => void;
}

const FloatingActionButtons = React.memo<FloatingActionButtonsProps>(({ whatsappNumber, cartCount, activeTab, onOpenCart }) => (
  <div className="fixed bottom-16 sm:bottom-6 left-4 z-40 flex flex-col items-center gap-2">
    <a
      href={getWhatsAppLink(whatsappNumber, 'مرحباً متجر الملاح، أود الاستفسار عن الأسماك المتوفرة اليوم')}
      target="_blank"
      rel="noreferrer"
      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all cursor-pointer"
      title="تواصل معنا واتساب"
    >
      <MessageCircle className="w-6 h-6" />
    </a>

    {cartCount > 0 && activeTab !== 'cart' && (
      <button
        onClick={onOpenCart}
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all relative cursor-pointer"
        title="إتمام الطلب"
      >
        <ShoppingCart className="w-5 h-5 text-cyan-400 dark:text-cyan-600" />
        <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">{cartCount}</span>
      </button>
    )}
  </div>
));
FloatingActionButtons.displayName = 'FloatingActionButtons';

const PaymentPolicyBanner: React.FC = () => {
  const [config, setConfig] = useState<PaymentConfig | null>(null);

  useEffect(() => {
    let active = true;
    void api.getPaymentConfig().then((result) => {
      if (active && result.success && result.data) setConfig(result.data);
    });
    return () => { active = false; };
  }, []);

  if (!config) return null;

  return (
    <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900 bg-cyan-50/70 dark:bg-cyan-950/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
        <ShieldCheck className="w-4 h-4 text-cyan-700 dark:text-cyan-300 shrink-0" />
        <span className="font-bold">
          {config.defaultPaymentPolicy === 'deposit_required'
            ? 'سياسة الدفع الحالية: العربون الإلكتروني إجباري.'
            : 'سياسة الدفع الحالية: يمكنك اختيار العربون الإلكتروني أو الدفع عند الاستلام.'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-black">
        <span className={config.providers.vfCashAvailable ? 'text-emerald-600' : 'text-slate-400'}><Smartphone className="w-3.5 h-3.5 inline ml-1" />VF-Cash {config.providers.vfCashAvailable ? 'متاح' : 'غير متاح'}</span>
        <span className={config.providers.bankAlAhlyAvailable ? 'text-emerald-600' : 'text-slate-400'}><Landmark className="w-3.5 h-3.5 inline ml-1" />البنك الأهلي {config.providers.bankAlAhlyAvailable ? 'متاح' : 'غير متاح'}</span>
      </div>
    </div>
  );
};

export const CustomerStoreApp: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    visibleProducts,
    categories,
    selectedCategory,
    setSelectedCategory,
    cartCount,
    storeSettings
  } = useStore();

  const [isPending, startTransition] = useTransition();

  const handleOpenCart = useCallback(() => {
    startTransition(() => setActiveTab('cart'));
  }, [setActiveTab]);

  const handleSelectCategory = useCallback((cat: ProductCategory | 'all') => {
    startTransition(() => setSelectedCategory(cat));
  }, [setSelectedCategory]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white transition-colors" dir="rtl">
      <Navbar />

      {isPending && <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 z-50 animate-pulse" />}

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        {(activeTab === 'products' || activeTab === 'cart') && <DeliveryCutoffBanner />}

        {activeTab === 'products' && (
          <ProductsCatalogView
            visibleProducts={visibleProducts}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {activeTab === 'cart' && (
          <>
            <PaymentPolicyBanner />
            <CheckoutFlow />
          </>
        )}

        {activeTab === 'orders' && <OrdersTracker />}
        {activeTab === 'favorites' && <FavoritesView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'about' && <AboutPage />}
        {activeTab === 'delivery' && <DeliveryPolicyPage />}
        {activeTab === 'contact' && <ContactPage />}
      </main>

      <FloatingActionButtons
        whatsappNumber={storeSettings.whatsappNumber}
        cartCount={cartCount}
        activeTab={activeTab}
        onOpenCart={handleOpenCart}
      />

      <SearchModal />
      <ProductDetailModal />
      <RealtimePaymentOverlay />
      <Footer />
      <BottomNav />
    </div>
  );
};
