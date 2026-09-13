import React, { useState } from 'react';
import { Plus, Minus, ShoppingCart, Heart, Check, Scale } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product }) => {
  const { addToCart, favorites, toggleFavorite, setSelectedProductForModal } = useStore();
  
  const activeVariants = product.variants?.filter(v => v.isActive) || [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(() => {
    return activeVariants[0]?.id;
  });

  const currentVariant: ProductVariant | undefined = activeVariants.find(v => v.id === selectedVariantId) || activeVariants[0];

  const minQty = product.minOrder || 1;
  const maxQty = product.maxOrder || 99;
  const [quantity, setQuantity] = useState<number>(minQty);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const isFav = favorites.includes(product.id);

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantity((prev) => (prev < maxQty ? prev + 1 : prev));
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantity((prev) => (prev > minQty ? prev - 1 : minQty));
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.inStock) return;
    
    addToCart(product, quantity, currentVariant);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 1200);
  };

  const currentPrice = currentVariant ? currentVariant.price : product.price;
  const currentOriginalPrice = currentVariant?.originalPrice || product.originalPrice;
  const hasDiscount = currentOriginalPrice && currentOriginalPrice > currentPrice;
  const discountPercent = hasDiscount 
    ? Math.round(((currentOriginalPrice! - currentPrice) / currentOriginalPrice!) * 100)
    : 0;

  return (
    <div
      id={`product-card-${product.id}`}
      onClick={() => setSelectedProductForModal(product)}
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border transition-all duration-200 flex flex-col justify-between cursor-pointer ${
        product.inStock
          ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
          : 'border-slate-200 dark:border-slate-800 opacity-75 bg-slate-50 dark:bg-slate-900/60'
      }`}
    >
      {/* Top Media Section */}
      <div>
        <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2.5 border border-slate-100 dark:border-slate-800">
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            loading="lazy"
          />

          {/* Badges Overlay */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            {product.badgeText && (
              <span className="bg-slate-900 dark:bg-black/90 text-amber-300 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                {product.badgeText}
              </span>
            )}
            {hasDiscount && (
              <span className="bg-rose-600 text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                خصم {discountPercent}%
              </span>
            )}
          </div>

          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(product.id);
            }}
            id={`fav-btn-${product.id}`}
            className="absolute top-2 left-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-xs z-10 cursor-pointer"
            title="إضافة للمفضلة"
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform active:scale-125 ${
                isFav ? 'text-rose-500 fill-rose-500' : 'hover:scale-110'
              }`}
            />
          </button>

          {/* Stock Status Badge */}
          <div className="absolute bottom-2 right-2">
            {product.inStock ? (
              <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                طازج صيد اليوم
              </span>
            ) : (
              <span className="bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                غير متوفر حالياً
              </span>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="space-y-1.5">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors leading-snug line-clamp-1">
            {product.name}
          </h3>

          {/* Pieces & Weight specifications */}
          {(currentVariant?.pieceCount || product.piecesPerKiloRange) && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-md w-fit border border-cyan-100 dark:border-cyan-900/50">
              <Scale className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>
                {currentVariant?.pieceCount 
                  ? `${currentVariant.pieceCount} حبات تقريباً للكيلو` 
                  : product.piecesPerKiloRange}
              </span>
            </div>
          )}

          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed pt-0.5">
            {product.description}
          </p>

          {/* Variants Selector */}
          {activeVariants.length > 1 && (
            <div className="pt-1.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                اختر الحجم وعدد الحبات:
              </span>
              <div className="flex flex-wrap gap-1">
                {activeVariants.map((v) => {
                  const isSelected = v.id === currentVariant?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVariantId(v.id);
                      }}
                      className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition-all text-right cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-50 dark:bg-cyan-950/80 border-cyan-500 text-cyan-800 dark:text-cyan-200 ring-1 ring-cyan-500/30'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span>{v.label}</span>
                      <span className="text-[9px] font-normal opacity-80 mr-1">({v.price} ج)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing and Action Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
        
        {/* Price display */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">{currentPrice}</span>
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">جنيه / {product.unit}</span>
          </div>

          {hasDiscount && (
            <span className="text-xs text-slate-400 dark:text-slate-500 line-through font-medium">
              {currentOriginalPrice} ج
            </span>
          )}
        </div>

        {/* Quantity Stepper: [-] X كيلو [+] */}
        {product.inStock && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700"
          >
            <button
              onClick={handleDecrement}
              id={`decrease-qty-${product.id}`}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center shadow-2xs active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-slate-600"
              title="تقليل الكمية"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <div className="text-center font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1">
              <span>{quantity}</span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{product.unit}</span>
            </div>

            <button
              onClick={handleIncrement}
              id={`increase-qty-${product.id}`}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="زيادة الكمية"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock}
          id={`add-to-cart-btn-${product.id}`}
          className={`w-full py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
            !product.inStock
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
              : justAdded
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-950'
          }`}
        >
          {justAdded ? (
            <>
              <Check className="w-4 h-4" />
              <span>تمت الإضافة للسلة</span>
            </>
          ) : !product.inStock ? (
            <span>غير متوفر حالياً</span>
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 dark:text-cyan-700" />
              <span>أضف للسلة 🛒</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
});
