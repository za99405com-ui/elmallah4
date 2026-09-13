import React, { useState } from 'react';
import { 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  ShieldCheck, 
  MessageCircle,
  Truck,
  Info
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getWhatsAppLink } from '../utils/whatsapp';
import { CheckoutModal } from './CheckoutModal';

export const Cart: React.FC = () => {
  const { 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    cartSubtotal,
    cartDepositRequired,
    appliedCoupon, 
    couponDiscount,
    applyCoupon, 
    removeCoupon,
    currentDeliveryFee,
    selectedRegionId,
    setSelectedRegionId,
    activeRegions,
    setActiveTab,
    storeSettings
  } = useStore();

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCodeInput.trim()) return;
    const success = applyCoupon(couponCodeInput.trim());
    if (success) {
      setCouponCodeInput('');
    } else {
      setCouponError('كود الخصم غير صالح أو منتهي الصلاحية');
    }
  };

  const discountedTotal = Math.max(0, cartSubtotal - couponDiscount);
  const finalTotal = discountedTotal + currentDeliveryFee;

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">سلة المشتريات فارغة</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          لم تقم بإضافة أي أصناف من الأسماك البحرية الطازجة بعد. تصفح صيد اليوم واختر أسماكك المفضلة!
        </p>
        <button
          onClick={() => setActiveTab('products')}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-all cursor-pointer"
        >
          <span>تصفح صيد اليوم</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span>سلة المشتريات ({cart.length} أصناف)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">راجع أصناف الأسماك المختارة وتفاصيل التجهيز</p>
        </div>
        <button
          onClick={() => setActiveTab('products')}
          className="text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>إضافة المزيد من الأسماك</span>
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-3">
          {cart.map((item) => {
            const product = item.product;
            const itemTotal = product.price * item.quantity;
            return (
              <div 
                key={product.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex gap-3.5 items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800" 
                  />
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{product.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {product.price} ج.م / {product.unit}
                    </p>
                    {product.piecesPerKiloRange && (
                      <span className="inline-block text-[10px] bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-md font-medium">
                        {product.piecesPerKiloRange}
                      </span>
                    )}
                    {item.notes && (
                      <p className="text-[10px] text-slate-500 italic">ملاحظات: {item.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                    {itemTotal.toLocaleString()} ج.م
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/80 p-0.5">
                      <button
                        onClick={() => updateCartQuantity(product.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="تقليل الكمية"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(product.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="زيادة الكمية"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(product.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      title="حذف من السلة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Delivery Region Selection */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>منطقة التوصيل المحددة:</span>
            </label>
            <select
              value={selectedRegionId}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
            >
              {activeRegions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.governorate} - {reg.cities.join('، ')} — رسوم التوصيل: {reg.deliveryFee} ج.م ({reg.estimatedTime || 'في نفس اليوم'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Order Summary & Actions */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-2xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
              ملخص الحساب
            </h3>

            {/* Coupon Section */}
            <div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    <span>تم تطبيق الكوبون ({appliedCoupon.code})</span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-rose-600 hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-1.5">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    placeholder="كود الخصم (مثال: FRESH10)"
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl hover:opacity-90 cursor-pointer"
                  >
                    تطبيق
                  </button>
                </form>
              )}
              {couponError && <p className="text-[11px] text-rose-500 font-medium mt-1">{couponError}</p>}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>إجمالي الأصناف:</span>
                <span className="font-bold text-slate-900 dark:text-white">{cartSubtotal.toLocaleString()} ج.م</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>إجمالي الخصم:</span>
                  <span>- {couponDiscount.toLocaleString()} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>رسوم التوصيل:</span>
                <span className="font-bold text-slate-900 dark:text-white">{currentDeliveryFee} ج.م</span>
              </div>

              {cartDepositRequired > 0 && (
                <div className="flex justify-between p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 font-bold">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>العربون المطلوب لتأكيد الحجز:</span>
                  </span>
                  <span>{cartDepositRequired.toLocaleString()} ج.م</span>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between text-sm font-black text-slate-900 dark:text-white">
                <span>الإجمالي النهائي:</span>
                <span className="text-cyan-700 dark:text-cyan-400">{finalTotal.toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* Checkout Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setIsCheckoutModalOpen(true)}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>متابعة إتمام الطلب</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>

              <a
                href={getWhatsAppLink(
                  storeSettings.whatsappNumber,
                  `مرحباً متجر الملاح، أود تأكيد طلبي التالي من سلة المشتريات:\n${cart.map(i => `- ${i.product.name} (${i.quantity} ${i.product.unit})`).join('\n')}\nالإجمالي: ${finalTotal} ج.م`
                )}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال الطلب مباشرة عبر واتساب</span>
              </a>
            </div>
          </div>

          <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <span>يتم تجهيز وتنظيف الأسماك وتغليفها حرارياً بالثلج لضمان وصولها طازجة تماماً إلى باب منزلك.</span>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutModalOpen && (
        <CheckoutModal 
          isOpen={isCheckoutModalOpen} 
          onClose={() => setIsCheckoutModalOpen(false)} 
        />
      )}
    </div>
  );
};
