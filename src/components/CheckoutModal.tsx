import React, { useState } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  Truck, 
  Phone, 
  MapPin, 
  User, 
  FileText,
  MessageCircle,
  CreditCard
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { PaymentMethod, Order } from '../types';
import { getWhatsAppLink } from '../utils/whatsapp';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { 
    cart, 
    cartSubtotal, 
    couponDiscount,
    currentDeliveryFee, 
    cartDepositRequired, 
    regions,
    selectedRegionId,
    createOrder, 
    appliedCoupon, 
    currentUser, 
    storeSettings,
    clearCart
  } = useStore();

  const activeRegion = regions.find(r => r.id === selectedRegionId) || regions[0];

  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const discountedTotal = Math.max(0, cartSubtotal - couponDiscount);
  const finalTotal = discountedTotal + currentDeliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      setErrorMessage('يرجى ملء جميع الحقول الإلزامية (الاسم، الهاتف، العنوان)');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        customerName: customerName.trim(),
        customerPhone: phone.trim(),
        governorate: activeRegion?.governorate || 'القاهرة',
        city: activeRegion?.cities[0] || 'الرئيسية',
        address: address.trim(),
        notes: notes.trim(),
        paymentMode: paymentMethod === 'cash_on_delivery' ? 'cash_on_delivery' : 'deposit_online',
        paymentMethod,
        depositPaid: 0
      });

      if (order) {
        setCreatedOrder(order);
        clearCart();
      } else {
        setErrorMessage('تعذر تسجيل الطلب، يرجى المحاولة مرة أخرى.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء حفظ الطلب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWhatsAppMessage = () => {
    const itemsList = createdOrder
      ? createdOrder.items.map(item => `• ${item.productName} - الكمية: ${item.quantity} ${item.unit} (${item.itemTotal} ج.م)`)
      : cart.map(item => `• ${item.product.name} - الكمية: ${item.quantity} ${item.product.unit} (${item.product.price * item.quantity} ج.م)`);

    const orderSubtotal = createdOrder ? createdOrder.subtotal : cartSubtotal;
    const orderDeliveryFee = createdOrder ? createdOrder.deliveryFee : currentDeliveryFee;
    const orderTotal = createdOrder ? createdOrder.total : finalTotal;
    const orderDeposit = createdOrder ? createdOrder.depositRequired : cartDepositRequired;

    const lines = [
      `🐟 *طلب جديد من متجر الملاح للأسماك*`,
      `كود الطلب: *${createdOrder?.orderNumber || 'جديد'}*`,
      `---------------------------------`,
      `👤 العميل: ${customerName}`,
      `📱 الهاتف: ${phone}`,
      `📍 العنوان: ${address} (${activeRegion?.governorate || ''} - ${activeRegion?.cities?.join('، ') || ''})`,
      `💳 طريقة الدفع: ${paymentMethod === 'cash_on_delivery' ? 'عند الاستلام' : paymentMethod === 'instapay' ? 'إنستاباي' : 'فودافون كاش'}`,
      `---------------------------------`,
      `📦 *الأصناف المطلوبة:*`,
      ...itemsList,
      `---------------------------------`,
      `💵 إجمالي الأصناف: ${orderSubtotal} ج.م`,
      `🚚 رسوم التوصيل: ${orderDeliveryFee} ج.م`,
      appliedCoupon ? `🏷️ كود الخصم: ${appliedCoupon.code} (-${couponDiscount} ج.م)` : '',
      orderDeposit > 0 ? `🛡️ العربون المطلوب: ${orderDeposit} ج.م` : '',
      `💰 *الإجمالي النهائي:* ${orderTotal} ج.م`,
      notes ? `📝 ملاحظات التنظيف والتجهيز: ${notes}` : '',
      `---------------------------------`,
      `يرجى تأكيد موعد وصول صيد اليوم وشكراً!`
    ].filter(Boolean);

    return lines.join('\n');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-black">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">إتمام طلب الأسماك الطازجة</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">تأكيد بيانات التوصيل والتجهيز</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Screen with WhatsApp Button */}
        {createdOrder ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">تم تسجيل طلبك بنجاح!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                رقم كود الطلب الخاص بك: <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{createdOrder.orderNumber}</span>
              </p>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-medium text-right space-y-1">
              <p className="font-bold">🚀 خطوة تأكيد الحجز السريع:</p>
              <p>اضغط على الزر أدناه لإرسال تفاصيل طلبك مباشرة لإدارة المتجر عبر واتساب لتأكيد تحضير صيد اليوم واستلام إشعار التجهيز.</p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={getWhatsAppLink(storeSettings.whatsappNumber, generateWhatsAppMessage())}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال تفاصيل الطلب عبر واتساب الآن</span>
              </a>

              <button
                onClick={onClose}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                إغلاق والعودة للمتجر
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyan-600" />
                  <span>الاسم بالكامل:</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد محمود"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-cyan-600" />
                  <span>رقم الهاتف (واتساب):</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 01012345678"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                <span>عنوان التوصيل بالتفصيل ({activeRegion?.governorate}):</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الشارع، رقم العمارة، الشقة، علامة مميزة"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-cyan-600" />
                <span>طريقة الدفع وتأكيد الحجز:</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash_on_delivery', title: 'عند الاستلام' },
                  { id: 'instapay', title: 'إنستاباي' },
                  { id: 'vodafone_cash', title: 'فودافون كاش' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      paymentMethod === m.id
                        ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {m.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-xs font-bold mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-cyan-600" />
                <span>ملاحظات التنظيف والتقطيع (اختياري):</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: تنظيف سنجاري للبلطي، تقطيع الجمبري، أو أي تفاصيل خاصة..."
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden resize-none"
              />
            </div>

            {/* Total Summary Row */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl flex items-center justify-between text-xs border border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400 font-bold">المجموع المطلوب:</span>
              <span className="text-base font-black text-cyan-700 dark:text-cyan-400">
                {finalTotal.toLocaleString()} ج.م
              </span>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري تسجيل الطلب...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>تأكيد وتسجيل الطلب</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
