import React, { useState } from 'react';
import { Heart, Plus, Check } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product }) => {
  const {
    addToCart,
    favorites,
    toggleFavorite,
    setSelectedProductForModal
  } = useStore();

  const activeVariants =
    product.variants?.filter((variant) => variant.isActive) || [];

  const currentVariant = activeVariants[0];
  const currentPrice = currentVariant?.price ?? product.price;
  const isFav = favorites.includes(product.id);

  const [justAdded, setJustAdded] = useState(false);

  const handleQuickAdd = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!product.inStock) return;

    addToCart(product, product.minOrder || 1, currentVariant);

    setJustAdded(true);

    window.setTimeout(() => {
      setJustAdded(false);
    }, 900);
  };

  return (
    <article
      onClick={() => setSelectedProductForModal(product)}
      className="relative min-w-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer"
    >
      <div className="relative aspect-square bg-white dark:bg-slate-950 overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full h-full object-contain p-1"
        />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(product.id);
          }}
          className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-900/95 shadow flex items-center justify-center"
        >
          <Heart
            className={`w-4 h-4 ${
              isFav
                ? 'fill-rose-500 text-rose-500'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          />
        </button>

        {product.badgeText && (
          <span className="absolute top-2 right-2 max-w-[65%] truncate rounded-lg bg-emerald-700 text-white text-[9px] font-bold px-2 py-1">
            {product.badgeText}
          </span>
        )}

        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={!product.inStock}
          className={`absolute bottom-2 left-2 w-10 h-10 rounded-xl border shadow-md flex items-center justify-center active:scale-95 ${
            !product.inStock
              ? 'bg-slate-200 border-slate-300 text-slate-400'
              : justAdded
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-950 dark:text-white'
          }`}
        >
          {justAdded ? (
            <Check className="w-5 h-5" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </button>

        {!product.inStock && (
          <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/85 text-white text-[9px] font-bold px-2 py-1">
            غير متوفر
          </span>
        )}
      </div>

      <div className="p-2.5 text-right">
        <h3 className="font-bold text-[13px] sm:text-sm text-slate-900 dark:text-white leading-5 line-clamp-2 min-h-10">
          {product.name}
        </h3>

        {currentVariant?.label && (
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {currentVariant.label}
          </p>
        )}

        <div className="mt-2 flex items-end gap-1 flex-wrap">
          <span className="font-black text-base sm:text-lg text-slate-950 dark:text-white">
            {currentPrice}
          </span>

          <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
            جنيه / {product.unit}
          </span>
        </div>
      </div>
    </article>
  );
});

ProductCard.displayName = 'ProductCard';
