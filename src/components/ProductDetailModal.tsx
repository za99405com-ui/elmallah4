import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, Heart, Check, Truck, Scale, Tag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductVariant } from '../types';

export const ProductDetailModal: React.FC = () => {
  const { 
    selectedProductForModal, 
    setSelectedProductForModal, 
    addToCart, 
    favorites, 
    toggleFavorite,
    cutoffInfo
  } = useStore();

  const product = selectedProductForModal;
  const activeVariants = product?.variants?.filter(v => v.isActive) || [];

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(() => {
    return activeVariants[0]?.id;
  });

  const minQty = product?.minOrder || 1;
  const maxQty = product?.maxOrder || 99;
  const [quantity, setQuantity] = useState<number>(minQty);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  if (!product) return null;

  const currentVariant: ProductVariant | undefined = 
    activeVariants.find(v => v.id === selectedVariantId) || activeVariants[0];

  const currentPrice = currentVariant ? currentVariant.price : product.price;
  const currentOriginalPrice = currentVariant?.originalPrice || product.originalPrice;
  const hasDiscount = currentOriginalPrice && currentOriginalPrice > currentPrice;

  const isFav = favorites.includes(product.id);

  const handleAddToCart = () => {
    if (!product.inStock) return;
    addToCart(product, quantity, currentVariant);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setSelectedProductForModal(null);
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={() => setSelectedProductForModal(null)}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 text-right animate-fade-in relative my-auto"
        onClick={(e) => e.stopPropagation()}
        id="product-detail-modal"
      >
        {/* Close Button */}
        <button
          onClick={() => setSelectedProductForModal(null)}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-slate-900/60 dark:bg-black/70 hover:bg-slate-900 text-white flex items-center justify-center transition-colors z-20 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Product Image */}
        <div className="relative aspect-16/10 w-full bg-slate-100 dark:bg-slate-800">
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />

          <div className="absolute top-3 right-3 flex flex-col gap-1">
            {product.badgeText && (
              <span className="bg-slate-900 dark:bg-black/90 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-md shadow-xs">
                {product.badgeText}
              </span>
            )}
          </div>

          <button
            onClick={() => toggleFavorite(product.id)}
            className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-white/90 dark:bg-slate-900/90 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-xs cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 ${isFav ? 'text-rose-500 fill-rose-500' : ''}`}
            />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {product.name}
              </h2>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{currentPrice}</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">جنيه / {product.unit}</span>
              </div>
            </div>

            {hasDiscount && (
              <div className="text-xs text-rose-600 font-bold mt-0.5">
                وفر {currentOriginalPrice! - currentPrice} جنيه (السعر الأصلي: {currentOriginalPrice} ج)
              </div>
            )}
          </div>

          {/* Variants Selector in Detail Modal */}
          {activeVariants.length > 0 && (
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                اختر الحجم وعدد الحبات للكيلو:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeVariants.map((v) => {
                  const isSelected = v.id === currentVariant?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-50 dark:bg-cyan-950/80 border-cyan-500 text-cyan-900 dark:text-cyan-100 ring-2 ring-cyan-500/30'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs">{v.label}</span>
                        <span className="text-xs font-black text-cyan-700 dark:text-cyan-300">{v.price} ج</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <Scale className="w-3 h-3 text-slate-400" />
                        <span>{v.pieceCount} قطع تقريباً في الكيلو</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/70 text-xs">
            {(currentVariant?.pieceCount || product.piecesPerKiloRange) && (
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Scale className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">عدد القطع التقريبي:</span>
                  <span className="font-bold">
                    {currentVariant?.pieceCount ? `${currentVariant.pieceCount} حبات للكيلو` : product.piecesPerKiloRange}
                  </span>
                </div>
              </div>
            )}

            {product.pieceWeightRange && (
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">الوزن التقريبي للقطعة:</span>
                  <span className="font-bold">{product.pieceWeightRange}</span>
                </div>
              </div>
            )}

            {product.minOrder && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 col-span-full">
                * الحد الأدنى للطلب: <strong>{product.minOrder} {product.unit}</strong>
              </div>
            )}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {product.description}
          </p>

          {/* Delivery & Cutoff Quick Info */}
          <div className="bg-cyan-50/50 dark:bg-slate-800/60 rounded-2xl p-3 border border-cyan-100 dark:border-slate-700/60 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <Truck className="w-4 h-4 text-cyan-600" />
              <span>{cutoffInfo.badgeLabel}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              الطلب الآن سيصلك مبرداً وطازجاً في أسرع وقت. موعد إغلاق طلبات اليوم هو {cutoffInfo.cutoffTimeString}.
            </p>
          </div>

          {/* Quantity Selector & Total */}
          {product.inStock && (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-2xl p-2.5 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 pr-2">الكمية المطلوبة:</span>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((prev) => (prev > minQty ? prev - 1 : minQty))}
                  className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center font-bold shadow-2xs border border-slate-200 dark:border-slate-600 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="font-black text-slate-900 dark:text-white text-base min-w-8 text-center">
                  {quantity} {product.unit}
                </span>

                <button
                  onClick={() => setQuantity((prev) => (prev < maxQty ? prev + 1 : prev))}
                  className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2">
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all ${
                !product.inStock
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : justAdded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>تمت الإضافة للسلة بنجاح ✓</span>
                </>
              ) : !product.inStock ? (
                <span>الصنف غير متوفر حالياً</span>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 text-cyan-400 dark:text-cyan-700" />
                  <span>أضف للسلة • ({currentPrice * quantity} جنيه)</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
