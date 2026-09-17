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
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  RotateCcw,
  Landmark,
  FileText,
  User,
  Phone
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { Order, PaymentMode, PaymentMethod, CartItem, DeliveryRegion, getPaymentMethodLabel } from '../types';
import { 
  api, 
  PaymentConfig, 
  PaymentSession, 
  subscribeToPaymentSession, 
  contactPaymentSupport 
} from '../utils/api';
import { getWhatsAppLink } from '../utils/whatsapp';

type CheckoutStep = 'cart' | 'address' | 'payment' | 'online_payment' | 'confirmation';

const SESSION_STORAGE_KEY = 'almallah_checkout_payment_session';

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const secs = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

/* -------------------------------------------------------------------------- */
/* Subcomponent: Cart Item Row                                                */
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
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={item.product.image}
          alt={item.product.name}
          referrerPolicy="no-referrer"
          className="w-14 h-14 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shrink-0"
          loading="lazy"
        />
        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
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

          {item.notes && (
            <div className="text-[10px] text-slate-500 italic mt-0.5 truncate">
              ملاحظة: {item.notes}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onUpdateQuantity(itemKey, item.quantity - 1)}
            className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-transform"
            title="تقليل الكمية"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center font-bold text-slate-900 dark:text-white text-xs">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(itemKey, item.quantity + 1)}
            className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-transform"
            title="زيادة الكمية"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-left min-w-14 sm:min-w-16">
          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
            {itemTotal} ج
          </span>
        </div>

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
/* Subcomponent: Checkout Step Indicator                                      */
/* -------------------------------------------------------------------------- */
const CheckoutStepper: React.FC<{ currentStep: CheckoutStep }> = React.memo(({ currentStep }) => {
  const steps: { id: CheckoutStep; label: string; number: number }[] = [
    { id: 'cart', label: 'السلة', number: 1 },
    { id: 'address', label: 'العنوان', number: 2 },
    { id: 'payment', label: 'طريقة الدفع', number: 3 },
    { id: 'confirmation', label: 'تأكيد الطلب', number: 4 }
  ];

  const getStepIndex = (step: CheckoutStep): number => {
    switch (step) {
      case 'cart': return 0;
      case 'address': return 1;
      case 'payment': return 2;
      case 'online_payment': return 2; // Step 3 in progress
      case 'confirmation': return 3;
    }
  };

  const activeIndex = getStepIndex(currentStep);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 shadow-2xs border border-slate-200 dark:border-slate-800 mb-4">
      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        {steps.map((s, idx) => {
          const isCurrent = idx === activeIndex;
          const isDone = idx < activeIndex;

          return (
            <div key={s.id} className="flex flex-col items-center text-center">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                  isDone
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isCurrent
                    ? 'bg-cyan-700 text-white shadow-xs scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" /> : s.number}
              </div>
              <span
                className={`text-[10px] sm:text-xs truncate max-w-full px-0.5 ${
                  isCurrent
                    ? 'font-bold text-cyan-800 dark:text-cyan-300'
                    : isDone
                    ? 'font-bold text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-400 font-medium'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
CheckoutStepper.displayName = 'CheckoutStepper';

/* -------------------------------------------------------------------------- */
/* Main Component: CheckoutFlow                                               */
/* -------------------------------------------------------------------------- */
export const CheckoutFlow: React.FC = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    appliedCoupon,
    couponDiscount,
    couponError,
    applyCoupon,
    removeCoupon,
    regions,
    activeRegions,
    createOrder,
    currentUser,
    storeSettings,
    setActiveTab,
    setCurrentTrackedOrder,
    resumedPaymentOrder,
    setResumedPaymentOrder
  } = useStore();

  // Current Step state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('cart');

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponSuccessMsg, setCouponSuccessMsg] = useState('');

  // Address Form State
  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [governorate, setGovernorate] = useState('الإسكندرية');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [orderNotes, setOrderNotes] = useState('');
  const [addressErrors, setAddressErrors] = useState<{ [key: string]: string }>({});

  // Payment Selection State
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('deposit_online');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('vodafone_cash');
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [isLoadingPaymentConfig, setIsLoadingPaymentConfig] = useState(false);

  // Active Online Payment Session & Order State
  const [activeOnlineOrder, setActiveOnlineOrder] = useState<Order | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState(0);
  const [sessionErrorMsg, setSessionErrorMsg] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isContactingSupport, setIsContactingSupport] = useState(false);

  // Confirmed Order for Final Step
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Default region selection on load
  useEffect(() => {
    if (activeRegions.length > 0 && !selectedRegionId) {
      setSelectedRegionId(activeRegions[0].id);
    }
  }, [activeRegions, selectedRegionId]);

  // Delivery fee calculation
  const currentRegion = useMemo(() => {
    return regions.find(r => r.id === selectedRegionId);
  }, [regions, selectedRegionId]);

  const deliveryFee = currentRegion ? currentRegion.deliveryFee : 30;
  const totalAmount = Math.max(0, cartSubtotal + deliveryFee - couponDiscount);

  // Effective deposit requirement from admin3
  const depositRequired = useMemo(() => {
    if (paymentConfig?.defaultDepositAmount) {
      return Math.min(paymentConfig.defaultDepositAmount, totalAmount);
    }
    return Math.min(100, totalAmount);
  }, [paymentConfig, totalAmount]);

  const remainingAmount = Math.max(0, totalAmount - (paymentMode === 'cash_on_delivery' ? 0 : depositRequired));

  // Load payment configuration from admin3
  const fetchPaymentConfig = useCallback(async () => {
    setIsLoadingPaymentConfig(true);
    try {
      const res = await api.getPaymentConfig();
      if (res.success && res.data) {
        setPaymentConfig(res.data);
        // If COD is strictly forbidden by admin3, enforce online deposit
        if (res.data.defaultPaymentPolicy === 'deposit_required') {
          setPaymentMode('deposit_online');
          // Pick the first available online provider
          if (res.data.providers.vfCashAvailable) {
            setPaymentMethod('vodafone_cash');
          } else if (res.data.providers.bankAlAhlyAvailable) {
            setPaymentMethod('instapay');
          }
        }
      }
    } finally {
      setIsLoadingPaymentConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentConfig();
  }, [fetchPaymentConfig]);

  // Check for resumed payment from OrdersTracker (Test Case J)
  useEffect(() => {
    if (resumedPaymentOrder) {
      setActiveOnlineOrder(resumedPaymentOrder);
      setCurrentStep('online_payment');

      // Attempt to restore or create session for this unpaid order
      const initResumedSession = async () => {
        setIsSubmittingOrder(true);
        try {
          const provider = resumedPaymentOrder.paymentMethod === 'vodafone_cash' ? 'vf_cash' : 'bank_alahly';
          const sessionRes = await api.createPaymentSession({
            orderId: resumedPaymentOrder.id,
            customerPhone: resumedPaymentOrder.customerPhone,
            provider
          });

          if (sessionRes.success && sessionRes.data) {
            setPaymentSession(sessionRes.data);
            setSessionErrorMsg(null);
          } else {
            setSessionErrorMsg(sessionRes.error || 'لا يوجد جهاز دفع متاح حالياً لهذا الطلب. يمكنك مراجعته في صفحة طلباتي.');
          }
        } catch {
          setSessionErrorMsg('تعذر تخصيص جلسة دفع حالياً. طلبك مسجل بالفعل في صفحة طلباتي.');
        } finally {
          setIsSubmittingOrder(false);
        }
      };

      initResumedSession();
      setResumedPaymentOrder(null);
    }
  }, [resumedPaymentOrder, setResumedPaymentOrder]);

  // Check for stored active session on browser refresh (Test Case I)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.order && parsed?.session) {
          const expiresAtMs = new Date(parsed.session.expiresAt).getTime();
          if (expiresAtMs > Date.now() && parsed.session.status === 'pending') {
            setActiveOnlineOrder(parsed.order);
            setPaymentSession(parsed.session);
            setCurrentStep('online_payment');
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save active session to sessionStorage when updated
  useEffect(() => {
    if (activeOnlineOrder && paymentSession && paymentSession.status === 'pending') {
      try {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ order: activeOnlineOrder, session: paymentSession })
        );
      } catch {
        // Ignore
      }
    } else if (paymentSession && paymentSession.status !== 'pending') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [activeOnlineOrder, paymentSession]);

  // Subscribe to real-time events & polling for online payment session
  useEffect(() => {
    if (!paymentSession) return;

    // Calculate initial remaining seconds
    const exp = new Date(paymentSession.expiresAt).getTime();
    const initSecs = Math.max(0, Math.floor((exp - Date.now()) / 1000));
    setSessionRemainingSeconds(initSecs);

    // Countdown interval
    const countdownTimer = setInterval(() => {
      const currentRemaining = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setSessionRemainingSeconds(currentRemaining);
      if (currentRemaining <= 0) {
        setPaymentSession(prev => prev ? { ...prev, status: 'expired' } : null);
      }
    }, 1000);

    // Subscribe to SSE / Polling from admin3
    const unsubscribe = subscribeToPaymentSession(paymentSession, (updatedSession) => {
      setPaymentSession(updatedSession);

      // If payment is successfully confirmed (Test Case E)
      if (updatedSession.status === 'paid') {
        const paidAmt = Number(updatedSession.matchedAmount ?? updatedSession.expectedAmount ?? depositRequired);
        const orderUpdated: Order = {
          ...(activeOnlineOrder || ({} as Order)),
          depositStatus: 'confirmed',
          depositPaid: paidAmt,
          remainingAmount: Math.max(0, (activeOnlineOrder?.total || totalAmount) - paidAmt)
        };
        setConfirmedOrder(orderUpdated);
        setCurrentTrackedOrder(orderUpdated);
        setCurrentStep('confirmation');
        sessionStorage.removeItem(SESSION_STORAGE_KEY);

        // Confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {
          // Ignore
        }
      }
    });

    return () => {
      clearInterval(countdownTimer);
      unsubscribe();
    };
  }, [paymentSession, activeOnlineOrder, depositRequired, totalAmount, setCurrentTrackedOrder]);

  /* -------------------------------------------------------------------------- */
  /* Step 1: Handlers (Cart)                                                    */
  /* -------------------------------------------------------------------------- */
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponSuccessMsg('');
    const cleanCode = couponCodeInput.trim();
    if (!cleanCode) return;

    setIsApplyingCoupon(true);
    try {
      const ok = await applyCoupon(cleanCode);
      if (ok) {
        setCouponSuccessMsg('تم تطبيق كود الخصم بنجاح');
        setCouponCodeInput('');
      }
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleProceedToAddress = () => {
    if (cart.length === 0) return;
    setCurrentStep('address');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* -------------------------------------------------------------------------- */
  /* Step 2: Handlers (Address)                                                 */
  /* -------------------------------------------------------------------------- */
  const validateAddressForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!customerName.trim()) {
      errors.name = 'يرجى إدخال اسم المستلم';
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)';
    }

    if (!address.trim()) {
      errors.address = 'يرجى إدخال العنوان بالتفصيل (اسم الشارع، رقم العمارة والشقة)';
    }

    if (!selectedRegionId) {
      errors.region = 'يرجى اختيار المنطقة / المدينة لتحديد قيمة التوصيل';
    }

    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToPayment = () => {
    if (!validateAddressForm()) return;
    setCurrentStep('payment');
    fetchPaymentConfig();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* -------------------------------------------------------------------------- */
  /* Step 3: Handlers (Payment Selection & Submission)                          */
  /* -------------------------------------------------------------------------- */
  const handleFinalOrderSubmit = async () => {
    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    setSessionErrorMsg(null);

    try {
      const city = currentRegion && currentRegion.cities.length > 0 ? currentRegion.cities[0] : 'الإسكندرية';

      const orderResult = await createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        governorate,
        city,
        address: address.trim(),
        notes: orderNotes.trim() || undefined,
        paymentMode,
        paymentMethod
      });

      // Case A: Cash on Delivery (no online deposit)
      if (paymentMode === 'cash_on_delivery') {
        setConfirmedOrder(orderResult);
        setCurrentTrackedOrder(orderResult);
        setCurrentStep('confirmation');
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        } catch {
          // Ignore
        }
        return;
      }

      // Case B/C: Online Deposit Required
      setActiveOnlineOrder(orderResult);

      if (orderResult.activeSession) {
        setPaymentSession(orderResult.activeSession);
        setCurrentStep('online_payment');
      } else if (orderResult.sessionError) {
        // Case D: No payment device available
        setSessionErrorMsg(orderResult.sessionError);
        setCurrentStep('online_payment');
      } else {
        // Fallback: create session manually
        const provider = paymentMethod === 'vodafone_cash' ? 'vf_cash' : 'bank_alahly';
        const sessionRes = await api.createPaymentSession({
          orderId: orderResult.id,
          customerPhone: customerPhone.trim(),
          provider
        });

        if (sessionRes.success && sessionRes.data) {
          setPaymentSession(sessionRes.data);
          setCurrentStep('online_payment');
        } else {
          setSessionErrorMsg(sessionRes.error || 'تم تسجيل طلبك بنجاح، لكن لا يوجد جهاز دفع متاح حالياً.');
          setCurrentStep('online_payment');
        }
      }
    } catch (err: any) {
      setSessionErrorMsg(err?.message || 'تعذر إنشاء الطلب. يرجى مراجعة البيانات والمحاولة مجدداً.');
    } finally {
      setIsSubmittingOrder(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Step 4: Handlers (Online Payment Completion)                               */
  /* -------------------------------------------------------------------------- */
  const handleCopyAccount = () => {
    if (!paymentSession?.accountNumber) return;
    navigator.clipboard.writeText(paymentSession.accountNumber);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleContactSupportAfterExpiry = async () => {
    if (!paymentSession) return;
    setIsContactingSupport(true);
    try {
      await contactPaymentSupport(paymentSession);
      // Mark local session as needs_review
      setPaymentSession(prev => prev ? { ...prev, status: 'needs_review' } : null);
    } catch {
      // Ignore
    } finally {
      setIsContactingSupport(false);
      // Open WhatsApp with order details
      const orderNum = activeOnlineOrder?.orderNumber || paymentSession.orderId;
      const msg = `مرحباً متجر الملاح، أود المساعدة بخصوص تحويل عربون الطلب رقم ${orderNum} بقيمة ${paymentSession.expectedAmount} ج.م`;
      window.open(getWhatsAppLink(storeSettings.whatsappNumber, msg), '_blank');
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Empty Cart View                                                            */
  /* -------------------------------------------------------------------------- */
  if (cart.length === 0 && currentStep !== 'online_payment' && currentStep !== 'confirmation') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-xs max-w-md mx-auto my-8">
        <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-950/60 rounded-2xl flex items-center justify-center mx-auto mb-4 text-cyan-700 dark:text-cyan-400">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">
          سلة التسوق فارغة
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          لم تختر أي أصناف بعد. تصفح تشكيلتنا الطازجة من أسماك صيد اليوم وأضف ما يعجبك.
        </p>
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className="w-full py-3 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>تصفح الأسماك المتاحة الآن</span>
        </button>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* RENDER: STEP-BY-STEP VIEWS                                                 */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Stepper Progress */}
      <CheckoutStepper currentStep={currentStep} />

      {/* ================================================================== */}
      {/* STEP 1: CART PAGE ("ماذا سأشتري؟")                                 */}
      {/* ================================================================== */}
      {currentStep === 'cart' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
              <span>أصناف سلة الشراء ({cart.length})</span>
            </h2>
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إفراغ السلة</span>
            </button>
          </div>

          {/* Cart Items List */}
          <div className="space-y-2.5">
            {cart.map((item) => (
              <CartItemRow
                key={item.id || item.product.id}
                item={item}
                onUpdateQuantity={updateCartQuantity}
                onRemove={removeFromCart}
              />
            ))}
          </div>

          {/* Coupon Code Input */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Tag className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
              <span>كود الخصم (اختياري):</span>
            </div>

            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    الكود <strong>{appliedCoupon.code}</strong> مفعّل (خصم {couponDiscount} جنيه)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-rose-600 hover:text-rose-700 font-bold text-xs cursor-pointer px-2 py-1"
                >
                  إلغاء الكود
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="أدخل كود الخصم هنا..."
                  value={couponCodeInput}
                  onChange={(e) => {
                    setCouponCodeInput(e.target.value.toUpperCase());
                    setCouponSuccessMsg('');
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-cyan-500 uppercase"
                />
                <button
                  type="submit"
                  disabled={isApplyingCoupon || !couponCodeInput.trim()}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  {isApplyingCoupon ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>تطبيق</span>
                  )}
                </button>
              </form>
            )}

            {/* Asynchronous Server Feedback */}
            {couponSuccessMsg && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>{couponSuccessMsg}</span>
              </p>
            )}
            {couponError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{couponError}</span>
              </p>
            )}
          </div>

          {/* Cart Pricing Summary Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>قيمة الأصناف:</span>
              <span className="font-bold text-slate-900 dark:text-white">{cartSubtotal} جنيه</span>
            </div>

            {couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>خصم الكوبون:</span>
                <span>- {couponDiscount} جنيه</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>التوصيل التقديري:</span>
              <span className="font-medium text-slate-500">يُحسب في الخطوة التالية حسب منطقتك</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm font-black text-slate-900 dark:text-white">
              <span>الإجمالي المبدئي:</span>
              <span className="text-cyan-700 dark:text-cyan-400 text-base">{Math.max(0, cartSubtotal - couponDiscount)} جنيه</span>
            </div>
          </div>

          {/* Action CTA Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleProceedToAddress}
              className="w-full py-3.5 px-6 bg-cyan-700 hover:bg-cyan-800 text-white font-black text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>المتابعة إلى بيانات التوصيل</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 2: ADDRESS PAGE ("أين سيصل طلبي؟")                              */}
      {/* ================================================================== */}
      {currentStep === 'address' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
              <span>بيانات التوصيل والاستلام</span>
            </h2>
            <button
              type="button"
              onClick={() => setCurrentStep('cart')}
              className="text-xs text-slate-500 hover:text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة للسلة</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 text-xs">
            {/* Customer Name */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                الاسم الكامل <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
              {addressErrors.name && (
                <p className="text-[11px] text-rose-600 font-bold mt-1">{addressErrors.name}</p>
              )}
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                رقم الهاتف (للتواصل عند التوصيل) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="01012345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-right focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
              {addressErrors.phone && (
                <p className="text-[11px] text-rose-600 font-bold mt-1">{addressErrors.phone}</p>
              )}
            </div>

            {/* Governorate & Region/Zone Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  المحافظة <span className="text-rose-500">*</span>
                </label>
                <select
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="الإسكندرية">الإسكندرية</option>
                  <option value="البحيرة">البحيرة (أطراف الإسكندرية)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  المنطقة / الحي (لتحديد التوصيل) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                >
                  {activeRegions.length === 0 && <option value="">جاري تحميل المناطق...</option>}
                  {activeRegions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.governorate} - {reg.cities.join('، ')} ({reg.deliveryFee} جنيه توصيل)
                    </option>
                  ))}
                </select>
                {addressErrors.region && (
                  <p className="text-[11px] text-rose-600 font-bold mt-1">{addressErrors.region}</p>
                )}
              </div>
            </div>

            {/* Detailed Address */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                العنوان بالتفصيل <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="اسم الشارع، رقم العمارة، الدور، رقم الشقة، علامة مميزة..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
              {addressErrors.address && (
                <p className="text-[11px] text-rose-600 font-bold mt-1">{addressErrors.address}</p>
              )}
            </div>

            {/* Special Delivery Notes */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                ملاحظات خاصة (اختياري)
              </label>
              <input
                type="text"
                placeholder="أي ملاحظات خاصة بالتنظيف، التقطيع، أو موعد التوصيل المفضل..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Delivery Fee Notice */}
          <div className="bg-cyan-50/70 dark:bg-cyan-950/30 rounded-xl p-3 border border-cyan-200 dark:border-cyan-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-cyan-900 dark:text-cyan-200">
              <Truck className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
              <span>رسوم التوصيل لمنطقة ({currentRegion?.cities ? currentRegion.cities.join('، ') : 'المحددة'}):</span>
            </div>
            <span className="font-black text-cyan-800 dark:text-cyan-300">{deliveryFee} جنيه</span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep('cart')}
              className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={handleProceedToPayment}
              className="flex-1 py-3.5 px-6 bg-cyan-700 hover:bg-cyan-800 text-white font-black text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>المتابعة إلى طريقة الدفع</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 3: PAYMENT METHOD PAGE ("كيف سأدفع؟")                           */}
      {/* ================================================================== */}
      {currentStep === 'payment' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
              <span>اختيار طريقة الدفع</span>
            </h2>
            <button
              type="button"
              onClick={() => setCurrentStep('address')}
              className="text-xs text-slate-500 hover:text-slate-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>تعديل العنوان</span>
            </button>
          </div>

          {/* Admin3 Deposit Policy Explanation Banner */}
          <div className="bg-cyan-50/80 dark:bg-cyan-950/40 rounded-2xl p-4 border border-cyan-200 dark:border-cyan-800">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-cyan-700 dark:text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-bold text-cyan-950 dark:text-cyan-100">
                  {paymentConfig?.defaultPaymentPolicy === 'deposit_required'
                    ? 'يلزم سداد عربون لتأكيد الطلب'
                    : 'خيارات الدفع المتاحة لطلبك'}
                </h4>
                <p className="text-cyan-900/80 dark:text-cyan-200/80 leading-relaxed text-[11px]">
                  {paymentConfig?.defaultPaymentPolicy === 'deposit_required'
                    ? `نظراً لأن الأسماك تُجهز وتُنظف طازجة خصيصاً لك صيد اليوم، يلزم سداد عربون رمزي بقيمة ${depositRequired} جنيه لتأكيد تجهيز الطلب، والمبلغ المتبقي (${remainingAmount} جنيه) يُسدد نقداً عند الاستلام.`
                    : `يمكنك اختيار دفع عربون رمزي لتأكيد الطلب وبدء التجهيز، أو اختيار الدفع بالكامل نقداً عند الاستلام.`}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Method Options */}
          <div className="space-y-2.5">
            {/* Option 1: Cash on Delivery (only if allowed by admin3 policy) */}
            {paymentConfig?.defaultPaymentPolicy !== 'deposit_required' && (
              <label
                className={`block p-4 rounded-2xl border transition-all cursor-pointer ${
                  paymentMode === 'cash_on_delivery'
                    ? 'border-cyan-700 bg-cyan-50/40 dark:bg-cyan-950/30 ring-1 ring-cyan-700'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment_option"
                      checked={paymentMode === 'cash_on_delivery'}
                      onChange={() => {
                        setPaymentMode('cash_on_delivery');
                        setPaymentMethod('cash_on_delivery');
                      }}
                      className="w-4 h-4 text-cyan-700 focus:ring-cyan-500"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                        <span>الدفع نقداً عند الاستلام</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        سداد إجمالي المبلغ ({totalAmount} جنيه) نقداً لمندوب التوصيل عند استلام الأسماك.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {totalAmount} ج
                  </span>
                </div>
              </label>
            )}

            {/* Option 2: Vodafone Cash (Online Deposit) */}
            <label
              className={`block p-4 rounded-2xl border transition-all cursor-pointer ${
                paymentMode === 'deposit_online' && paymentMethod === 'vodafone_cash'
                  ? 'border-cyan-700 bg-cyan-50/40 dark:bg-cyan-950/30 ring-1 ring-cyan-700'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              } ${paymentConfig && !paymentConfig.providers.vfCashAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment_option"
                    disabled={paymentConfig ? !paymentConfig.providers.vfCashAvailable : false}
                    checked={paymentMode === 'deposit_online' && paymentMethod === 'vodafone_cash'}
                    onChange={() => {
                      setPaymentMode('deposit_online');
                      setPaymentMethod('vodafone_cash');
                    }}
                    className="w-4 h-4 text-cyan-700 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-rose-600" />
                      <span>فودافون كاش (Vodafone Cash)</span>
                      {paymentConfig?.providers.vfCashAvailable ? (
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          متاح لحظياً
                        </span>
                      ) : (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          غير متاح حالياً
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      تحويل عربون ({depositRequired} ج) عبر فودافون كاش، وتأكيد فوري لحظة وصول التحويل.
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-cyan-700 dark:text-cyan-400 block">
                    {depositRequired} ج الآن
                  </span>
                  <span className="text-[10px] text-slate-400">
                    متبقي {remainingAmount} ج
                  </span>
                </div>
              </div>
            </label>

            {/* Option 3: InstaPay / Bank Al Ahly (Online Deposit) */}
            <label
              className={`block p-4 rounded-2xl border transition-all cursor-pointer ${
                paymentMode === 'deposit_online' && paymentMethod === 'instapay'
                  ? 'border-cyan-700 bg-cyan-50/40 dark:bg-cyan-950/30 ring-1 ring-cyan-700'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              } ${paymentConfig && !paymentConfig.providers.bankAlAhlyAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment_option"
                    disabled={paymentConfig ? !paymentConfig.providers.bankAlAhlyAvailable : false}
                    checked={paymentMode === 'deposit_online' && paymentMethod === 'instapay'}
                    onChange={() => {
                      setPaymentMode('deposit_online');
                      setPaymentMethod('instapay');
                    }}
                    className="w-4 h-4 text-cyan-700 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-amber-600" />
                      <span>إنستاباي / البنك الأهلي (InstaPay)</span>
                      {paymentConfig?.providers.bankAlAhlyAvailable ? (
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          متاح لحظياً
                        </span>
                      ) : (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          غير متاح حالياً
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      تحويل عبر إنستاباي أو حساب البنك الأهلي المصري مع تأكيد فوري تلقائي.
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-xs font-black text-cyan-700 dark:text-cyan-400 block">
                    {depositRequired} ج الآن
                  </span>
                  <span className="text-[10px] text-slate-400">
                    متبقي {remainingAmount} ج
                  </span>
                </div>
              </div>
            </label>
          </div>

          {/* Final Order Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>إجمالي قيمة الأسماك:</span>
              <span className="font-bold text-slate-900 dark:text-white">{cartSubtotal} جنيه</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>رسوم التوصيل ({currentRegion?.cities ? currentRegion.cities.join('، ') : 'الإسكندرية'}):</span>
              <span className="font-bold text-slate-900 dark:text-white">{deliveryFee} جنيه</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>كود الخصم:</span>
                <span>- {couponDiscount} جنيه</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm font-black text-slate-900 dark:text-white">
              <span>إجمالي الطلب الكلي:</span>
              <span className="text-base font-black text-slate-900 dark:text-white">{totalAmount} جنيه</span>
            </div>

            {paymentMode === 'deposit_online' && (
              <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between text-cyan-800 dark:text-cyan-300 font-black">
                  <span>العربون المطلوب تحويله الآن:</span>
                  <span>{depositRequired} جنيه</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  <span>المتبقي عند الاستلام:</span>
                  <span>{remainingAmount} جنيه</span>
                </div>
              </div>
            )}
          </div>

          {/* Submission Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep('address')}
              className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={isSubmittingOrder}
              onClick={handleFinalOrderSubmit}
              className="flex-1 py-3.5 px-6 bg-cyan-700 hover:bg-cyan-800 text-white font-black text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل الطلب وتجهيز الدفع...</span>
                </>
              ) : paymentMode === 'cash_on_delivery' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد الطلب الآن (الدفع عند الاستلام)</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>متابعة لدفع العربون ({depositRequired} جنيه)</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 4: ONLINE PAYMENT COMPLETION ("أين وكم سأحوّل الآن؟")           */}
      {/* ================================================================== */}
      {currentStep === 'online_payment' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-xs font-bold">
              <span>طلب رقم: #{activeOnlineOrder?.orderNumber || 'الطلب'}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              إكمال تحويل العربون لتأكيد الطلب
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              طلبك تم تسجيله وحفظه بنجاح. لإتمام التأكيد وبدء التجهيز، يرجى تحويل العربون الرمزي عبر المحفظة الإلكترونية.
            </p>
          </div>

          {/* If there is a session allocation error (e.g. Test Case D: no payment device) */}
          {sessionErrorMsg && !paymentSession && (
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-5 border border-amber-200 dark:border-amber-800 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
              <div className="space-y-1 text-xs">
                <h3 className="font-bold text-amber-950 dark:text-amber-100 text-sm">
                  تم تسجيل وحفظ طلبك بنجاح!
                </h3>
                <p className="text-amber-900 dark:text-amber-200 leading-relaxed max-w-md mx-auto">
                  {sessionErrorMsg}
                </p>
                <p className="text-amber-800/80 dark:text-amber-300/80 text-[11px] pt-1">
                  لا داعي لإعادة إرسال الطلب، طلبك محفوظ في حسابك ولن يتم عمل طلب مكرر.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="flex-1 py-2.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  عرض طلبي في صفحة طلباتي
                </button>
                <a
                  href={getWhatsAppLink(storeSettings.whatsappNumber, `مرحباً متجر الملاح، سجلت الطلب ${activeOnlineOrder?.orderNumber} وأود تأكيده والمساعدة في سداد العربون.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مساعدة عبر واتساب</span>
                </a>
              </div>
            </div>
          )}

          {/* Active Payment Session Card */}
          {paymentSession && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
              {/* Countdown Timer & Status Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الوقت المتبقي للتحويل:
                  </span>
                </div>
                <div className="font-mono text-sm sm:text-base font-black px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-cyan-800 dark:text-cyan-300">
                  {formatCountdown(sessionRemainingSeconds)}
                </div>
              </div>

              {/* Exact Amount To Transfer */}
              <div className="bg-cyan-50/70 dark:bg-cyan-950/40 rounded-xl p-4 text-center border border-cyan-200 dark:border-cyan-800">
                <span className="text-xs font-bold text-cyan-900 dark:text-cyan-200 block mb-0.5">
                  المبلغ المطلوب تحويله بالضبط:
                </span>
                <span className="text-2xl sm:text-3xl font-black text-cyan-800 dark:text-cyan-300">
                  {paymentSession.expectedAmount} جنيه
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                  (يُرجى تحويل هذا المبلغ بالتمام دون زيادة أو نقصان لمطابقته فوراً)
                </span>
              </div>

              {/* Dynamic Account / Number Details from admin3 */}
              <div className="space-y-2 text-xs">
                <span className="block font-bold text-slate-800 dark:text-slate-200">
                  {paymentSession.provider === 'vf_cash' ? 'رقم محفظة فودافون كاش المخصص لطلبك:' : 'بيانات التحويل عبر إنستاباي / البنك الأهلي:'}
                </span>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="space-y-0.5">
                    <span className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wider" dir="ltr">
                      {paymentSession.accountNumber}
                    </span>
                    {paymentSession.accountName && (
                      <span className="block text-[11px] text-slate-500 font-medium">
                        الاسم: {paymentSession.accountName}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="px-3 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الرقم</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white">خطوات السداد السريعة:</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  <li>افتح تطبيق محفظتك (فودافون كاش) أو تطبيق إنستاباي.</li>
                  <li>حوّل مبلغ <strong>{paymentSession.expectedAmount} جنيه</strong> بالضبط إلى الرقم أعلاه.</li>
                  <li>ابق في هذه الصفحة لحظات، وسيقوم النظام بتأكيد طلبك آلياً فور رصد التحويل!</li>
                </ol>
              </div>

              {/* Real-time Status Indicator */}
              <div className="pt-2">
                {paymentSession.status === 'pending' && (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-bold animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>في انتظار وصول التحويل وتأكيده لحظياً...</span>
                  </div>
                )}

                {paymentSession.status === 'paid' && (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-black">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>تم استلام التحويل وتأكيد الطلب بنجاح! جارِ التوجيه...</span>
                  </div>
                )}

                {(paymentSession.status === 'expired' || sessionRemainingSeconds <= 0) && paymentSession.status !== 'paid' && paymentSession.status !== 'needs_review' && (
                  <div className="space-y-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                    <div className="flex items-center justify-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-bold">
                      <AlertCircle className="w-4 h-4" />
                      <span>انتهت مهلة الدفع (10 دقائق)</span>
                    </div>
                    <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
                      إذا كنت قد قمت بالتحويل بالفعل، لا تقلق! اضغط بالأسفل لربط التحويل يدوياً ومراجعة طلبك فوراً مع خدمة العملاء.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isContactingSupport}
                        onClick={handleContactSupportAfterExpiry}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>تواصلت أو قمت بالتحويل؟ اضغط هنا للمساعدة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className="py-2.5 px-4 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        الذهاب لطلباتي
                      </button>
                    </div>
                  </div>
                )}

                {(paymentSession.status === 'needs_review' || paymentSession.status === 'expired_needs_review') && (
                  <div className="space-y-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                    <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                      <Clock className="w-4 h-4" />
                      <span>الطلب قيد مراجعة التحويل يدوياً</span>
                    </div>
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                      تم تحويل طلبك لفريق خدمة العملاء لمطابقة التحويل يدوياً وتأكيده دون الحاجة لتكرار الطلب.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="mt-2 py-2 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      متابعة الطلب في صفحة طلباتي
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 5: ORDER CONFIRMATION PAGE ("هل تم إنشاء وتأكيد طلبي بنجاح؟")   */}
      {/* ================================================================== */}
      {currentStep === 'confirmation' && confirmedOrder && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                تم استلام طلبك وتأكيده بنجاح!
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                رقم الطلب: #{confirmedOrder.orderNumber}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                جاري تجهيز الأسماك الطازجة وتنظيفها بعناية لتصلك مبردة حتى باب منزلك.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-xs text-right space-y-2.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>اسم العميل:</span>
                <span className="font-bold text-slate-900 dark:text-white">{confirmedOrder.customerName}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>هاتف التواصل:</span>
                <span className="font-bold text-slate-900 dark:text-white" dir="ltr">{confirmedOrder.customerPhone}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>عنوان التوصيل:</span>
                <span className="font-bold text-slate-900 dark:text-white">{confirmedOrder.governorate} - {confirmedOrder.city}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>طريقة الدفع:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {getPaymentMethodLabel(confirmedOrder.paymentMethod, confirmedOrder.rawPaymentMethod)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-slate-900 dark:text-white font-bold">
                <span>إجمالي الطلب:</span>
                <span>{confirmedOrder.total} جنيه</span>
              </div>

              {confirmedOrder.depositPaid > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>العربون المسدد (مؤكد ✓):</span>
                  <span>{confirmedOrder.depositPaid} جنيه</span>
                </div>
              )}

              <div className="flex justify-between text-cyan-800 dark:text-cyan-300 font-black text-sm pt-1">
                <span>المتبقي عند الاستلام:</span>
                <span>{confirmedOrder.remainingAmount} جنيه</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="flex-1 py-3 px-4 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>تتبع طلبي في صفحة طلباتي</span>
              </button>

              <a
                href={getWhatsAppLink(
                  storeSettings.whatsappNumber,
                  `مرحباً متجر الملاح، أود تأكيد ومتابعة الطلب رقم ${confirmedOrder.orderNumber} باسم ${confirmedOrder.customerName}`
                )}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>مشاركة وتأكيد عبر واتساب</span>
              </a>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className="text-xs text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
              >
                العودة للتسوق والمزيد من الأسماك
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
