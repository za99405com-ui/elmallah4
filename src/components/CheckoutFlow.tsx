import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  MapPin, 
  ArrowLeft, 
  ArrowRight, 
  Truck, 
  Clock, 
  Sparkles,
  MessageCircle,
  Tag,
  CreditCard,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
  Banknote,
  Zap,
  Smartphone,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { Order, PaymentMode, PaymentMethod, CartItem, DeliveryRegion } from '../types';
import { getWhatsAppLink } from '../utils/whatsapp';

/* -------------------------------------------------------------------------- */
/* Subcomponent 1: Cart Item Row (Memoized)                                  */
/* -------------------------------------------------------------------------- */
interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

const CartItemRow = React.memo<CartItemRowProps>(({ item, onUpdateQuantity, onRemove }) => {
  const itemKey = item.id || item.product.id;
  const unitPrice = item.variant ? item.variant.price : item.product.price;
  const itemTotal = unitPrice * item.quantity;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3 transition-colors">
      {/* Product info */}
      <div className="flex items-center gap-3">
        <img
          src={item.product.image}
          alt={item.product.name}
          referrerPolicy="no-referrer"
          className="w-14 h-14 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shrink-0"
          loading="lazy"
        />
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
            {item.product.name}
          </h4>
          
          {item.variant ? (
            <div className="text-[10px] font-bold text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 w-fit mt-0.5">
              {item.variant.label} ({item.variant.price} ج)
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {item.product.price} ج / {item.product.unit}
            </div>
          )}

          {item.product.piecesPerKiloRange && !item.variant && (
            <div className="text-[10px] text-cyan-700 dark:text-cyan-400">
              {item.product.piecesPerKiloRange}
            </div>
          )}
        </div>
      </div>

      {/* Stepper + Item Total + Delete */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Stepper */}
        <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onUpdateQuantity(itemKey, item.quantity - 1)}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-transform"
            title="تقليل الكمية"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-8 sm:w-9 text-center font-bold text-slate-900 dark:text-white text-xs">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(itemKey, item.quantity + 1)}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-transform"
            title="زيادة الكمية"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Price */}
        <div className="text-left min-w-14 sm:min-w-16">
          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
            {itemTotal} ج
          </span>
        </div>

        {/* Remove Item */}
        <button
          type="button"
          onClick={() => onRemove(itemKey)}
          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
          title="حذف الصنف"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
CartItemRow.displayName = 'CartItemRow';

/* -------------------------------------------------------------------------- */
/* Subcomponent 2: Step Progress Bar (Memoized)                              */
/* -------------------------------------------------------------------------- */
interface StepProgressBarProps {
  step: 1 | 2 | 3;
}

const StepProgressBar = React.memo<StepProgressBarProps>(({ step }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 shadow-2xs border border-slate-200 dark:border-slate-800">
      <div className="grid grid-cols-3 gap-2">
        {/* Step 1 */}
        <div className={`flex flex-col items-center text-center transition-colors ${
          step >= 1 ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 font-medium'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mb-1 transition-all ${
            step === 1 
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            1
          </div>
          <span className="text-[11px] sm:text-xs">السلة</span>
        </div>

        {/* Step 2 */}
        <div className={`flex flex-col items-center text-center transition-colors ${
          step >= 2 ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400 font-medium'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mb-1 transition-all ${
            step === 2 
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs' 
              : step > 2 
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            2
          </div>
          <span className="text-[11px] sm:text-xs">التوصيل والدفع</span>
        </div>

        {/* Step 3 */}
        <div className={`flex flex-col items-center text-center transition-colors ${
          step === 3 ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-400 font-medium'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mb-1 transition-all ${
            step === 3 
              ? 'bg-emerald-600 text-white shadow-xs' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            3
          </div>
          <span className="text-[11px] sm:text-xs">تأكيد الطلب</span>
        </div>
      </div>
    </div>
  );
});
StepProgressBar.displayName = 'StepProgressBar';

/* -------------------------------------------------------------------------- */
/* Subcomponent 3: Coupon Section (Memoized)                                 */
/* -------------------------------------------------------------------------- */
interface CouponSectionProps {
  appliedCoupon: any;
  couponDiscount: number;
  couponError: string | null;
  couponSuccessMsg: string;
  couponCodeInput: string;
  onCouponInputChange: (code: string) => void;
  onApplyCoupon: (e: React.FormEvent) => void;
  onRemoveCoupon: () => void;
}

const CouponSection = React.memo<CouponSectionProps>(({
  appliedCoupon,
  couponDiscount,
  couponError,
  couponSuccessMsg,
  couponCodeInput,
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
        <Tag className="w-4 h-4 text-cyan-600" />
        <span>كوبون الخصم أو كود التخفيض:</span>
      </div>

      {appliedCoupon ? (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>الكوبون <strong>{appliedCoupon.code}</strong> مفعّل (خصم {couponDiscount} جنيه)</span>
          </div>
          <button
            type="button"
            onClick={onRemoveCoupon}
            className="text-rose-600 hover:text-rose-700 font-bold text-xs cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      ) : (
        <form onSubmit={onApplyCoupon} className="flex gap-2">
          <input
            type="text"
            value={couponCodeInput}
            onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
            placeholder="مثال: TAZA10 أو WELCOME50"
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white focus:outline-hidden"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
          >
            تطبيق
          </button>
        </form>
      )}

      {couponError && (
        <p className="text-rose-600 text-xs font-medium">{couponError}</p>
      )}
      {couponSuccessMsg && (
        <p className="text-emerald-600 text-xs font-bold">{couponSuccessMsg}</p>
      )}
    </div>
  );
});
CouponSection.displayName = 'CouponSection';

/* -------------------------------------------------------------------------- */
/* Subcomponent 4: Payment Selector Box (Memoized)                           */
/* -------------------------------------------------------------------------- */
interface PaymentSelectorBoxProps {
  paymentMode: PaymentMode;
  onlineDepositMethod: 'card' | 'instapay' | 'vodafone_cash';
  cartDepositRequired: number;
  remainingUponDelivery: number;
  depositAmountToPay: number;
  grandTotal: number;
  storeSettings: any;
  transactionRef: string;
  copiedKey: string | null;
  formErrorRef?: string;
  onSelectPaymentMode: (mode: PaymentMode) => void;
  onSelectOnlineDepositMethod: (method: 'card' | 'instapay' | 'vodafone_cash') => void;
  onTransactionRefChange: (val: string) => void;
  onCopy: (text: string, key: string) => void;
}

const PaymentSelectorBox = React.memo<PaymentSelectorBoxProps>(({
  paymentMode,
  onlineDepositMethod,
  cartDepositRequired,
  remainingUponDelivery,
  depositAmountToPay,
  grandTotal,
  storeSettings,
  transactionRef,
  copiedKey,
  formErrorRef,
  onSelectPaymentMode,
  onSelectOnlineDepositMethod,
  onTransactionRefChange,
  onCopy
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-cyan-600" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">طريقة الدفع وتأكيد الحجز</h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          اختر نظام السداد الأنسب لك
        </span>
      </div>

      {/* Two Primary Choices: Deposit Online vs Cash on Delivery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Choice A: Pay Deposit Online */}
        <div
          onClick={() => onSelectPaymentMode('deposit_online')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPaymentMode('deposit_online'); }}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer relative flex flex-col justify-between ${
            paymentMode === 'deposit_online'
              ? 'border-cyan-600 bg-cyan-50/50 dark:bg-cyan-950/30 text-slate-900 dark:text-white ring-1 ring-cyan-500 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                paymentMode === 'deposit_online'
                  ? 'border-cyan-600 bg-cyan-600 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {paymentMode === 'deposit_online' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">سداد عربون أونلاين</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200">
              تأكيد فوري
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
            دفع عربون جدية ({cartDepositRequired} جنيه) لحجز صيد الفجر وتأكيده فورياً، وسداد المتبقي ({remainingUponDelivery} جنيه) عند الاستلام.
          </p>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
            <Zap className="w-3.5 h-3.5" />
            <span>بطاقة بنكية، إنستاباي، أو فودافون كاش</span>
          </div>
        </div>

        {/* Choice B: Cash on Delivery */}
        <div
          onClick={() => onSelectPaymentMode('cash_on_delivery')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPaymentMode('cash_on_delivery'); }}
          className={`p-4 rounded-xl border text-right transition-all cursor-pointer relative flex flex-col justify-between ${
            paymentMode === 'cash_on_delivery'
              ? 'border-cyan-600 bg-cyan-50/50 dark:bg-cyan-950/30 text-slate-900 dark:text-white ring-1 ring-cyan-500 shadow-xs'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                paymentMode === 'cash_on_delivery'
                  ? 'border-cyan-600 bg-cyan-600 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              }`}>
                {paymentMode === 'cash_on_delivery' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">الدفع نقداً عند الاستلام</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              بدون عربون
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
            سداد كامل قيمة الطلب ({grandTotal} جنيه) نقداً لمندوب التوصيل بعد استلام الأسماك الطازجة وفحصها بالكامل.
          </p>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <Banknote className="w-3.5 h-3.5" />
            <span>كاش بالكامل عند الاستلام</span>
          </div>
        </div>
      </div>

      {/* MODE 1: PAY DEPOSIT ONLINE - REVEALS THE THREE SUPPORTED METHODS */}
      {paymentMode === 'deposit_online' && (
        <div className="space-y-3 pt-1">
          {/* Deposit Explanation */}
          <div className="bg-cyan-50 dark:bg-slate-800/80 p-3 rounded-xl border border-cyan-200 dark:border-slate-700 text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-cyan-900 dark:text-cyan-200">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>حجز صيد الفجر الطازج بعربون الجدية:</span>
              </div>
              <span className="font-mono text-cyan-800 dark:text-cyan-300 font-black">{depositAmountToPay} جنيه</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              لحجز الأسماك طازجة باسمك من صيد الفجر، يُرجى سداد عربون بقيمة <strong>{depositAmountToPay} جنيه</strong>، وسداد باقي المبلغ (<strong>{remainingUponDelivery} جنيه</strong>) لمندوب التوصيل.
            </p>
          </div>

          {/* Sub-Tabs: 3 Supported Deposit Methods */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Card */}
            <button
              type="button"
              onClick={() => onSelectOnlineDepositMethod('card')}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                onlineDepositMethod === 'card'
                  ? 'border-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/50 text-cyan-900 dark:text-cyan-200 shadow-2xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <CreditCard className="w-4 h-4 text-cyan-600" />
              <span className="font-bold text-xs">بطاقة بنكية</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">فيزا / ماستر كارد</span>
            </button>

            {/* 2. InstaPay */}
            <button
              type="button"
              onClick={() => onSelectOnlineDepositMethod('instapay')}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                onlineDepositMethod === 'instapay'
                  ? 'border-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/50 text-cyan-900 dark:text-cyan-200 shadow-2xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-xs">إنستاباي</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">تحويل فوري لحظي</span>
            </button>

            {/* 3. Vodafone Cash */}
            <button
              type="button"
              onClick={() => onSelectOnlineDepositMethod('vodafone_cash')}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                onlineDepositMethod === 'vodafone_cash'
                  ? 'border-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/50 text-cyan-900 dark:text-cyan-200 shadow-2xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <Smartphone className="w-4 h-4 text-rose-500" />
              <span className="font-bold text-xs">فودافون كاش</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">محفظة إلكترونية</span>
            </button>
          </div>

          {/* Conditional Method Content */}
          {onlineDepositMethod === 'card' && (
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>دفع إلكتروني آمن بالبطاقة البنكية</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                يتم الدفع عبر بوابة دفع مشفرة بالكامل. لا نقوم بتسجيل أو تخزين أي بيانات للبطاقات البنكية. سيتم تسجيل وتأكيد الحجز فورياً في النظام.
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <span>العربون المطلوب تحصيله بالبطاقة:</span>
                <span className="font-bold text-cyan-700 dark:text-cyan-300 font-mono text-sm">{depositAmountToPay} جنيه</span>
              </div>
            </div>
          )}

          {(onlineDepositMethod === 'instapay' || onlineDepositMethod === 'vodafone_cash') && (
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {onlineDepositMethod === 'instapay' ? 'بيانات التحويل عبر إنستاباي:' : 'بيانات التحويل عبر فودافون كاش:'}
                </span>
                <span className="text-cyan-700 dark:text-cyan-400 font-mono font-bold">العربون: {depositAmountToPay} جنيه</span>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block">
                    {onlineDepositMethod === 'instapay' ? 'رقم / حساب إنستاباي المعتمد:' : 'رقم محفظة فودافون كاش:'}
                  </span>
                  <strong className="font-mono text-sm tracking-wider text-slate-900 dark:text-white" dir="ltr">
                    {onlineDepositMethod === 'instapay'
                      ? (storeSettings.instapayNumber || '01015192040')
                      : (storeSettings.vodafoneCashNumber || '01015192040')}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => onCopy(
                    onlineDepositMethod === 'instapay'
                      ? (storeSettings.instapayNumber || '01015192040')
                      : (storeSettings.vodafoneCashNumber || '01015192040'),
                    'payNum'
                  )}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedKey === 'payNum' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'payNum' ? 'تم النسخ' : 'نسخ الرقم'}</span>
                </button>
              </div>

              {/* Sender Phone/Account Input */}
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs mb-1">
                  {onlineDepositMethod === 'instapay'
                    ? 'رقم الهاتف أو حساب إنستاباي المحول منه:'
                    : 'رقم محفظة فودافون كاش المحول منها:'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => onTransactionRefChange(e.target.value)}
                  placeholder={
                    onlineDepositMethod === 'instapay'
                      ? 'مثال: 01012345678 أو حساب إنستاباي المرسل منه...'
                      : 'مثال: 01012345678...'
                  }
                  className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden ${
                    formErrorRef ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {formErrorRef && (
                  <p className="text-rose-600 text-[11px] font-medium mt-0.5">{formErrorRef}</p>
                )}
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  * يُرجى كتابة الرقم لمطابقة التحويل ومراجعته من قِبل إدارة المتجر لتأكيد الحجز.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: CASH ON DELIVERY - HIDES DEPOSIT INPUTS */}
      {paymentMode === 'cash_on_delivery' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>الدفع نقداً عند الاستلام متاح بدون أي عربون مسبق</span>
          </div>
          <p className="text-emerald-800/90 dark:text-emerald-300 leading-relaxed">
            سيتم تجهيز طلبك طازجاً من صيد الفجر والتواصل معك هاتفياً قبل خروج مندوب التوصيل المبرد. سداد المبلغ بالكامل (<strong>{grandTotal} جنيه</strong>) نقداً لمندوب التوصيل عند استلام الأسماك.
          </p>
        </div>
      )}
    </div>
  );
});
PaymentSelectorBox.displayName = 'PaymentSelectorBox';

/* -------------------------------------------------------------------------- */
/* Main Component: CheckoutFlow                                               */
/* -------------------------------------------------------------------------- */
export const CheckoutFlow: React.FC = React.memo(() => {
  const { 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart,
    cartSubtotal, 
    cartCount, 
    cartDepositRequired,
    createOrder,
    currentUser,
    setActiveTab,
    setCurrentTrackedOrder,
    cutoffInfo,
    appliedCoupon,
    couponDiscount,
    couponError,
    applyCoupon,
    removeCoupon,
    regions,
    activeRegions,
    selectedRegionId,
    setSelectedRegionId,
    currentDeliveryFee,
    storeSettings
  } = useStore();

  // 1: Cart, 2: Delivery & Payment, 3: Order Confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delivery Form State with saved profile defaults
  const [customerName, setCustomerName] = useState<string>(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(currentUser?.phone || '');
  const [address, setAddress] = useState<string>(currentUser?.address || '');
  const [notes, setNotes] = useState<string>('');

  // Selected Region & City
  const currentRegion = useMemo(() => {
    return regions.find(r => r.id === selectedRegionId) || activeRegions[0];
  }, [regions, selectedRegionId, activeRegions]);

  const [city, setCity] = useState<string>(() => currentRegion?.cities[0] || 'مدينة نصر');

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [couponSuccessMsg, setCouponSuccessMsg] = useState<string>('');

  // Payment & Deposit state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('deposit_online');
  const [onlineDepositMethod, setOnlineDepositMethod] = useState<'card' | 'instapay' | 'vodafone_cash'>('instapay');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Completed order reference
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentRegion?.cities && currentRegion.cities.length > 0) {
      if (!currentRegion.cities.includes(city)) {
        setCity(currentRegion.cities[0]);
      }
    }
  }, [selectedRegionId, currentRegion, city]);

  // Overall totals
  const totalBeforeDiscount = cartSubtotal + currentDeliveryFee;
  const grandTotal = useMemo(() => Math.max(0, totalBeforeDiscount - couponDiscount), [totalBeforeDiscount, couponDiscount]);
  const depositAmountToPay = useMemo(() => paymentMode === 'cash_on_delivery' ? 0 : cartDepositRequired, [paymentMode, cartDepositRequired]);
  const remainingUponDelivery = useMemo(() => paymentMode === 'cash_on_delivery' ? grandTotal : Math.max(0, grandTotal - depositAmountToPay), [paymentMode, grandTotal, depositAmountToPay]);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const handleApplyCoupon = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;
    const ok = applyCoupon(couponCodeInput);
    if (ok) {
      setCouponSuccessMsg('تم تطبيق كود الخصم بنجاح! 🎉');
      setTimeout(() => setCouponSuccessMsg(''), 3000);
    }
  }, [couponCodeInput, applyCoupon]);

  const handleUpdateQuantity = useCallback((id: string, qty: number) => {
    updateCartQuantity(id, qty);
  }, [updateCartQuantity]);

  const handleRemoveFromCart = useCallback((id: string) => {
    removeFromCart(id);
  }, [removeFromCart]);

  const validateDeliveryForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!customerName.trim()) {
      errors.customerName = 'من فضلك اكتب اسمك الكريم';
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 10) {
      errors.customerPhone = 'من فضلك اكتب رقم هاتف صحيح للتواصل (11 رقم)';
    }
    if (!address.trim()) {
      errors.address = 'من فضلك اكتب العنوان بالتفصيل (اسم الشارع، رقم العمارة، رقم الشقة)';
    }
    if (currentRegion?.minOrderAmount && cartSubtotal < currentRegion.minOrderAmount) {
      errors.regionMin = `الحد الأدنى للطلب في منطقة ${currentRegion.governorate} هو ${currentRegion.minOrderAmount} جنيه`;
    }
    if (paymentMode === 'deposit_online') {
      if ((onlineDepositMethod === 'instapay' || onlineDepositMethod === 'vodafone_cash') && !transactionRef.trim()) {
        errors.transactionRef = 'برجاء كتابة رقم الهاتف أو المحفظة المحول منها لمطابقة التحويل وتأكيد الحجز';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customerName, customerPhone, address, currentRegion, cartSubtotal, paymentMode, onlineDepositMethod, transactionRef]);

  const handleProceedToDelivery = useCallback(() => {
    if (cart.length === 0) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [cart.length]);

  const handlePlaceOrder = useCallback(async () => {
    if (!validateDeliveryForm() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitErrorMessage(null);

    const effectivePaymentMethod: PaymentMethod =
      paymentMode === 'cash_on_delivery' ? 'cash_on_delivery' : onlineDepositMethod;

    try {
      const order = await createOrder({
        customerName,
        customerPhone,
        governorate: currentRegion?.governorate || 'القاهرة',
        city,
        address,
        notes,
        paymentMode,
        paymentMethod: effectivePaymentMethod,
        depositPaid: depositAmountToPay,
        depositTransactionRef:
          paymentMode === 'cash_on_delivery'
            ? undefined
            : onlineDepositMethod === 'card'
              ? 'دفع إلكتروني بالبطاقة'
              : transactionRef.trim()
      });

      setPlacedOrder(order);
      setStep(3);
      setIsSubmitting(false);

      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Ignored
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Order placement failed:', err);
      setSubmitErrorMessage(err?.message || 'تعذر تأكيد الطلب. يرجى مراجعة البيانات والمحاولة مرة أخرى.');
      setIsSubmitting(false);
    }
  }, [
    validateDeliveryForm, 
    isSubmitting, 
    createOrder, 
    customerName, 
    customerPhone, 
    currentRegion, 
    city, 
    address, 
    notes, 
    paymentMode, 
    onlineDepositMethod, 
    depositAmountToPay, 
    transactionRef
  ]);

  // If Cart is empty and we are in Step 1 or 2
  if (cart.length === 0 && step !== 3) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-700 dark:text-slate-200">
          <ShoppingCart className="w-10 h-10 text-cyan-600 dark:text-cyan-400" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">سلة التسوق فارغة حالياً 🐟</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-xs sm:text-sm">
            لم تقم بإضافة أي سمك طازج بعد. تصفح الأصناف الطازجة صيد اليوم واطلب بضغطة واحدة!
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-sm rounded-xl shadow-xs hover:scale-102 transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <span>تصفح الأسماك الطازجة</span>
          <span>🐟</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-3 px-3 sm:px-4 space-y-4">
      
      {/* 3-Step Visual Progress Bar */}
      <StepProgressBar step={step} />

      {/* STEP 1: CART ITEMS REVIEW & COUPON */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Delivery Cutoff Info */}
          <div className={`rounded-xl p-3 border text-xs flex items-center justify-between gap-2 transition-colors ${
            cutoffInfo.isBeforeCutoff
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                {cutoffInfo.isBeforeCutoff ? (
                  <>موعد إغلاق اليوم: <strong>{cutoffInfo.cutoffTimeString}</strong> | طلبك سيصل <strong>اليوم مبرد</strong></>
                ) : (
                  <>تم تجاوز موعد 3:00 ص | طلبك سيصل <strong>غداً مبرد</strong></>
                )}
              </span>
            </div>
            <span className="font-bold text-[10px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0">
              {cutoffInfo.badgeLabel}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>سلتك</span>
              <span className="text-slate-500 text-sm font-normal">({cartCount} صنف)</span>
            </h2>

            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تفريغ</span>
            </button>
          </div>

          {/* Cart Items List */}
          <div className="space-y-2.5">
            {cart.map((item) => (
              <CartItemRow
                key={item.product.id}
                item={item}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveFromCart}
              />
            ))}
          </div>

          {/* Coupon Code Section */}
          <CouponSection
            appliedCoupon={appliedCoupon}
            couponDiscount={couponDiscount}
            couponError={couponError}
            couponSuccessMsg={couponSuccessMsg}
            couponCodeInput={couponCodeInput}
            onCouponInputChange={setCouponCodeInput}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={removeCoupon}
          />

          {/* Cart Summary & Next Button */}
          <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 border border-slate-800">
            <div className="space-y-1.5 text-xs font-medium border-b border-slate-800 pb-3">
              <div className="flex justify-between text-slate-300">
                <span>إجمالي ثمن الأسماك:</span>
                <span className="font-bold text-white text-sm">{cartSubtotal} جنيه</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>خصم الكوبون ({appliedCoupon?.code}):</span>
                  <span className="font-bold">-{couponDiscount} جنيه</span>
                </div>
              )}

              <div className="flex justify-between text-slate-300">
                <span>العربون المطلوب لجدية صيد الفجر:</span>
                <span className="font-bold text-amber-300 text-sm">{cartDepositRequired} جنيه</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-bold">المجموع الفرعي:</span>
              <span className="text-xl font-black text-white">{Math.max(0, cartSubtotal - couponDiscount)} جنيه</span>
            </div>

            <button
              type="button"
              onClick={handleProceedToDelivery}
              id="proceed-to-step2-btn"
              className="w-full py-3 bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>متابعة بيانات التوصيل والدفع</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: DELIVERY DETAILS & PAYMENT */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>بيانات التوصيل والدفع</span>
              <span className="text-base">📍</span>
            </h2>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الرجوع للسلة</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
            {/* Auto-filled badge if user exists */}
            {currentUser?.name && (
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-700 dark:text-slate-200 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600" />
                <span>تم ملء بياناتك تلقائياً لتوفير وقتك</span>
              </div>
            )}

            {/* Name and Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-900 dark:text-slate-100 text-xs mb-1">
                  الاسم الكريم: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  id="checkout-input-name"
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden ${
                    formErrors.customerName ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {formErrors.customerName && (
                  <p className="text-rose-600 text-[11px] font-medium mt-0.5">{formErrors.customerName}</p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-900 dark:text-slate-100 text-xs mb-1">
                  رقم الهاتف (للتواصل والتوصيل): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  dir="ltr"
                  id="checkout-input-phone"
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white text-right focus:outline-hidden ${
                    formErrors.customerPhone ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {formErrors.customerPhone && (
                  <p className="text-rose-600 text-[11px] font-medium mt-0.5">{formErrors.customerPhone}</p>
                )}
              </div>
            </div>

            {/* Region / Governorate & Area Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-900 dark:text-slate-100 text-xs mb-1">
                  منطقة التوصيل / المحافظة:
                </label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  id="checkout-select-gov"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
                >
                  {activeRegions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.governorate} (توصيل مبرد 🚚)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-900 dark:text-slate-100 text-xs mb-1">
                  الحي / المنطقة التابعة:
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  id="checkout-select-city"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
                >
                  {currentRegion?.cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formErrors.regionMin && (
              <p className="text-rose-600 text-xs font-bold">{formErrors.regionMin}</p>
            )}

            {/* Detailed Address */}
            <div>
              <label className="block font-bold text-slate-900 dark:text-slate-100 text-xs mb-1">
                العنوان بالتفصيل (اسم الشارع، رقم العمارة، رقم الشقة): <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: شارع النصر، عمارة 10، الدور الثالث شقة 5"
                id="checkout-input-address"
                className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden ${
                  formErrors.address ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {formErrors.address && (
                <p className="text-rose-600 text-[11px] font-medium mt-0.5">{formErrors.address}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block font-bold text-slate-900 dark:text-slate-100 text-xs mb-1">
                ملاحظات للتوصيل (اختياري):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: الاتصال عند الوصول..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-hidden text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* PAYMENT METHODS & DEPOSIT BOX */}
          <PaymentSelectorBox
            paymentMode={paymentMode}
            onlineDepositMethod={onlineDepositMethod}
            cartDepositRequired={cartDepositRequired}
            remainingUponDelivery={remainingUponDelivery}
            depositAmountToPay={depositAmountToPay}
            grandTotal={grandTotal}
            storeSettings={storeSettings}
            transactionRef={transactionRef}
            copiedKey={copiedKey}
            formErrorRef={formErrors.transactionRef}
            onSelectPaymentMode={setPaymentMode}
            onSelectOnlineDepositMethod={setOnlineDepositMethod}
            onTransactionRefChange={setTransactionRef}
            onCopy={handleCopy}
          />

          {/* Step 2 Order Summary Box & Final Trigger */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>ثمن الأسماك الطازجة:</span>
                <span className="font-bold text-slate-900 dark:text-white">{cartSubtotal} جنيه</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>خصم الكوبون ({appliedCoupon?.code}):</span>
                  <span>-{couponDiscount} جنيه</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                <span>التوصيل المبرد:</span>
                <span>مجاناً 🚚</span>
              </div>
              <div className="flex justify-between font-black text-slate-900 dark:text-white border-t border-slate-100 dark:border-slate-800 pt-1.5">
                <span>إجمالي الطلب الكلي:</span>
                <span className="text-base">{grandTotal} جنيه</span>
              </div>
              {paymentMode === 'deposit_online' ? (
                <>
                  <div className="flex justify-between text-cyan-700 dark:text-cyan-400 font-bold">
                    <span>العربون المطلوب سداده الآن:</span>
                    <span>{depositAmountToPay} جنيه</span>
                  </div>
                  <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold">
                    <span>المتبقي للدليفري عند الاستلام:</span>
                    <span>{remainingUponDelivery} جنيه</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
                    <span>العربون المسبق:</span>
                    <span className="text-emerald-600 font-bold">غير مطلوب (0 جنيه)</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                    <span>المطلوب سداده نقداً عند الاستلام:</span>
                    <span>{grandTotal} جنيه</span>
                  </div>
                </>
              )}
            </div>

            {submitErrorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold leading-relaxed">
                {submitErrorMessage}
              </div>
            )}

            {/* Confirmation Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handlePlaceOrder}
              id="confirm-order-giant-btn"
              className={`w-full py-3.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 ${
                isSubmitting ? 'opacity-75 cursor-not-allowed' : 'active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ تسجيل وتأكيد الطلب...</span>
                </>
              ) : paymentMode === 'cash_on_delivery' ? (
                <>
                  <span>تأكيد الطلب والدفع عند الاستلام 🐟</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>إرسال الطلب ومراجعة العربون 🐟</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS & CONFIRMATION */}
      {step === 3 && placedOrder && (
        <div className="space-y-4 text-center">
          
          {/* Success Banner */}
          <div className="bg-slate-900 dark:bg-black text-white rounded-3xl p-6 sm:p-8 shadow-xs space-y-3 border border-slate-800">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto text-2xl ${
              placedOrder.paymentMode === 'cash_on_delivery' || placedOrder.depositStatus === 'not_required'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
            }`}>
              {placedOrder.paymentMode === 'cash_on_delivery' || placedOrder.depositStatus === 'not_required' ? '🐟' : '⏳'}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black">
                {placedOrder.paymentMode === 'cash_on_delivery' || placedOrder.depositStatus === 'not_required'
                  ? 'تم تأكيد تسجيل طلبك بنجاح! 🐟'
                  : 'تم استلام طلبك وبانتظار مراجعة التحويل وتأكيد الحجز ⏳'}
              </h2>
              <p className="text-slate-300 text-sm font-medium">
                رقم الطلب: <span className="text-amber-300 font-mono font-bold text-lg">{placedOrder.orderNumber}</span>
              </p>
              <p className="text-xs text-slate-300 max-w-md mx-auto pt-1 leading-relaxed">
                {placedOrder.paymentMode === 'cash_on_delivery' || placedOrder.depositStatus === 'not_required'
                  ? 'طلبك قيد التجهيز من صيد الفجر الطازج وسيصلك مبرد. سداد المبلغ بالكامل نقداً لمندوب التوصيل عند الاستلام.'
                  : `طلبك الآن قيد المراجعة لدى إدارة متجر الملاح. سيتم تأكيد الحجز والبدء في التجهيز فور مطابقة تحويل العربون${placedOrder.depositTransactionRef ? ` من الرقم (${placedOrder.depositTransactionRef})` : ''}.`}
              </p>
            </div>

            <div className="inline-block bg-slate-800 px-3 py-1 rounded-xl text-xs text-slate-200">
              موعد التسليم المتوقع: <strong className="text-cyan-300">{placedOrder.deliveryTargetDate || 'اليوم'}</strong> ({placedOrder.estimatedDeliveryTime || 'مبرد'})
            </div>
          </div>

          {/* Order Details Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 text-right">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">تفاصيل الحجز والمدفوعات:</h3>

            <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 border-y border-slate-100 dark:border-slate-800 py-2.5">
              {placedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{item.productName} ({item.quantity} {item.unit})</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.itemTotal} جنيه</span>
                </div>
              ))}
              {placedOrder.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>خصم الكوبون ({placedOrder.couponCode}):</span>
                  <span>-{placedOrder.discountAmount} جنيه</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-600 font-medium pt-1">
                <span>مصاريف التوصيل:</span>
                <span>مجاناً 🚚</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-1">
                <span>المبلغ الإجمالي:</span>
                <span>{placedOrder.total} جنيه</span>
              </div>

              {placedOrder.paymentMode === 'cash_on_delivery' || placedOrder.depositStatus === 'not_required' ? (
                <>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>طريقة الدفع:</span>
                    <span>الدفع نقداً بالكامل عند الاستلام (كاش)</span>
                  </div>
                  <div className="flex justify-between text-slate-900 dark:text-white font-bold">
                    <span>المطلوب سداده لمندوب التوصيل:</span>
                    <span className="text-slate-900 dark:text-white font-black">{placedOrder.remainingAmount || placedOrder.total} جنيه</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-amber-700 dark:text-amber-300 font-bold">
                    <span>العربون (قيد المراجعة والتأكيد):</span>
                    <span>{placedOrder.depositPaid || placedOrder.depositRequired} جنيه</span>
                  </div>
                  <div className="flex justify-between text-slate-900 dark:text-white font-bold">
                    <span>المتبقي عند الاستلام:</span>
                    <span className="text-slate-900 dark:text-white font-black">{placedOrder.remainingAmount} جنيه</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
              <p><strong>العنوان:</strong> {placedOrder.governorate} - {placedOrder.city} - {placedOrder.address}</p>
              <p><strong>الهاتف:</strong> {placedOrder.customerPhone} ({placedOrder.customerName})</p>
              {placedOrder.depositTransactionRef && (
                <p><strong>المرجع / المحول منه:</strong> <span className="font-bold font-mono text-cyan-800 dark:text-cyan-300" dir="ltr">{placedOrder.depositTransactionRef}</span></p>
              )}
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCurrentTrackedOrder(placedOrder);
                  setActiveTab('orders');
                }}
                className="flex-1 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>متابعة حالة الطلب في طلباتي</span>
              </button>

              <a
                href={getWhatsAppLink(
                  storeSettings.whatsappNumber,
                  placedOrder.paymentMode === 'cash_on_delivery' || placedOrder.depositStatus === 'not_required'
                    ? `مرحباً متجر الملاح، أود تأكيد طلبي رقم ${placedOrder.orderNumber} بقيمة ${placedOrder.total} جنيه (الدفع كاش عند الاستلام).`
                    : `مرحباً متجر الملاح، أنا صاحب الطلب رقم ${placedOrder.orderNumber} بقيمة ${placedOrder.total} جنيه وقمت بتحويل العربون (${placedOrder.depositPaid || placedOrder.depositRequired} جنيه)${placedOrder.depositTransactionRef ? ` من الرقم ${placedOrder.depositTransactionRef}` : ''}.`
                )}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {placedOrder.paymentMode === 'cash_on_delivery' || placedOrder.depositStatus === 'not_required'
                    ? 'تأكيد الطلب عبر واتساب'
                    : 'إرسال إيصال التحويل عبر واتساب'}
                </span>
              </a>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('products');
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-xs underline cursor-pointer"
              >
                + طلب أسماك أخرى
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
CheckoutFlow.displayName = 'CheckoutFlow';
