import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  RotateCcw, 
  Phone, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  Truck, 
  AlertCircle, 
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Tag,
  History,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus } from '../types';
import { getWhatsAppLink } from '../utils/whatsapp';

export const OrdersTracker: React.FC = React.memo(() => {
  const { orders, reOrder, currentTrackedOrder, setActiveTab, storeSettings, refreshOrders } = useStore();
  const [searchPhoneOrNumber, setSearchPhoneOrNumber] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(
    currentTrackedOrder ? currentTrackedOrder.id : null
  );

  // Auto-refresh orders every 20s
  useEffect(() => {
    const timer = setInterval(() => {
      refreshOrders();
    }, 20000);
    return () => clearInterval(timer);
  }, [refreshOrders]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshOrders();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'new':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800',
          label: 'قيد مراجعة الحجز',
          icon: '⏳',
          description: 'الطلب قيد مراجعة وتأكيد الإدارة للتحقق من التحويل'
        };
      case 'preparing':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800',
          label: 'جاري التجهيز',
          icon: '📦',
          description: 'يتم الآن تحضير وتعبئة الأسماك الطازجة مبردة'
        };
      case 'on_delivery':
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800',
          label: 'خرج للتوصيل',
          icon: '🚚',
          description: 'المندوب في الطريق إليك مع حافظة التبريد'
        };
      case 'delivered':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
          label: 'تم التسليم',
          icon: '✅',
          description: 'تم تسليم طلبك بنجاح. بالهناء والشفاء!'
        };
      case 'cancelled':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800',
          label: 'تم الإلغاء',
          icon: '❌',
          description: 'تم إلغاء هذا الطلب'
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
          label: 'قيد المراجعة',
          icon: '📦',
          description: ''
        };
    }
  };

  // Only show active / ongoing orders (exclude delivered ones per user request)
  const activeOrders = orders.filter((o) => o.status !== 'delivered');
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  const filteredOrders = activeOrders.filter((order) => {
    if (!searchPhoneOrNumber.trim()) return true;
    const q = searchPhoneOrNumber.trim().toLowerCase();
    const cleanPhone = order.customerPhone.replace(/\D/g, '');
    const cleanQuery = q.replace(/\D/g, '');
    const matchesPhone = cleanQuery && cleanPhone.includes(cleanQuery);
    const matchesOrderNum = order.orderNumber.toLowerCase().includes(q);
    const matchesName = order.customerName.toLowerCase().includes(q);
    return matchesPhone || matchesOrderNum || matchesName;
  });

  return (
    <div className="max-w-3xl mx-auto py-3 px-3 sm:px-4 space-y-4">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>متابعة الطلبات الجارية</span>
              <span className="text-base">🚚</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              تتبع فوري ومباشر لطلباتك الحالية من التجهيز حتى خروج المندوب للتوصيل
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleManualRefresh}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="تحديث حالة الطلبات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-600' : ''}`} />
            </button>

            {deliveredCount > 0 && (
              <button
                onClick={() => setActiveTab('settings')}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
                title="عرض الطلبات المسلمة في السجل"
              >
                <History className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>السجل ({deliveredCount})</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('products')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              + طلب جديد 🐟
            </button>
          </div>
        </div>

        {/* Quick Search for active orders by Phone or Order ID */}
        <div className="relative">
          <input
            type="text"
            value={searchPhoneOrNumber}
            onChange={(e) => setSearchPhoneOrNumber(e.target.value)}
            placeholder="ابحث برقم هاتفك أو برقم الطلب (مثال: 01015192040 أو #1024)"
            className="w-full px-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 font-medium text-xs focus:outline-hidden"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Delivered Orders Link Notice */}
      {deliveredCount > 0 && (
        <div 
          onClick={() => setActiveTab('settings')}
          className="bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 rounded-2xl p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-cyan-100/60 dark:hover:bg-cyan-950/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                لديك {deliveredCount} طلب تم تسليمه بنجاح
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تم نقل الطلبات المكتملة إلى قسم (السجل) في الإعدادات لمراجعتها وإعادة طلبها
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1 shrink-0">
            <span>فتح السجل</span>
            <span>←</span>
          </span>
        </div>
      )}

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-xl">
            🚚
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">لا توجد طلبات جارية حالياً</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
            {deliveredCount > 0
              ? 'جميع طلباتك السابقة تم تسليمها بنجاح وهي محفوظة في خيار (السجل) بالإعدادات.'
              : 'ليس لديك طلبات نشطة قيد التحضير أو التوصيل الآن. يمكنك طلب أسماكك الطازجة بكل سهولة!'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setActiveTab('products')}
              className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              تصفح كتالوج الأسماك
            </button>
            {deliveredCount > 0 && (
              <button
                onClick={() => setActiveTab('settings')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" />
                <span>عرض السجل بالإعدادات</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((order) => {
            const badge = getStatusBadge(order.status);
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                id={`order-card-${order.id}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs transition-colors"
              >
                {/* Order Top Banner */}
                <div 
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-sm border border-slate-200 dark:border-slate-700 shrink-0">
                      🐟
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{order.orderNumber}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {order.deliveryTargetDate && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md">
                            التسليم: {order.deliveryTargetDate}
                          </span>
                        )}
                        {order.depositStatus === 'confirmed' && (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                            العربون مؤكد ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                        <span>{order.customerName}</span>
                        <span>•</span>
                        <span>{new Date(order.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'short' })}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right sm:text-left">
                      <span className="text-[10px] text-slate-400 block">المتبقي عند الاستلام:</span>
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{order.remainingAmount} جنيه</span>
                    </div>

                    <button
                      className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="عرض التفاصيل"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Live Step Progress Indicator */}
                <div className="px-3 sm:px-4 py-2.5 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                    {/* Step 1: New */}
                    <div className={`p-1.5 rounded-xl border ${
                      order.status === 'new'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 font-bold text-amber-900 dark:text-amber-200'
                        : order.status !== 'cancelled'
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        : 'opacity-40'
                    }`}>
                      <span className="block text-[10px]">🟡</span>
                      <span className="text-[10px]">مستلم</span>
                    </div>

                    {/* Step 2: Preparing */}
                    <div className={`p-1.5 rounded-xl border ${
                      order.status === 'preparing'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 font-bold text-blue-900 dark:text-blue-200'
                        : order.status === 'on_delivery' || order.status === 'delivered'
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        : 'opacity-40'
                    }`}>
                      <span className="block text-[10px]">📦</span>
                      <span className="text-[10px]">تجهيز</span>
                    </div>

                    {/* Step 3: On delivery */}
                    <div className={`p-1.5 rounded-xl border ${
                      order.status === 'on_delivery'
                        ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 dark:border-orange-700 font-bold text-orange-900 dark:text-orange-200'
                        : order.status === 'delivered'
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        : 'opacity-40'
                    }`}>
                      <span className="block text-[10px]">🚚</span>
                      <span className="text-[10px]">في الطريق</span>
                    </div>

                    {/* Step 4: Delivered */}
                    <div className={`p-1.5 rounded-xl border ${
                      order.status === 'delivered'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 font-bold text-emerald-900 dark:text-emerald-200'
                        : 'opacity-40'
                    }`}>
                      <span className="block text-[10px]">✅</span>
                      <span className="text-[10px]">تم التسليم</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1.5 text-center">
                    {badge.description}
                  </p>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    
                    {/* Items List */}
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1.5">الأصناف المطلوبة:</h4>
                      <div className="space-y-1.5">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="bg-slate-50 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={item.productImage}
                                alt={item.productName}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                              />
                              <div>
                                <span className="font-bold text-xs text-slate-900 dark:text-white block">
                                  {item.productName}
                                </span>
                                {item.variantLabel && (
                                  <span className="text-[10px] text-cyan-800 dark:text-cyan-300 font-bold bg-cyan-50 dark:bg-cyan-950/70 px-1 py-0.5 rounded border border-cyan-200 dark:border-cyan-800 w-fit block mt-0.5">
                                    {item.variantLabel}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {item.quantity} {item.unit} × {item.price} ج
                                </span>
                              </div>
                            </div>

                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {item.itemTotal} جنيه
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial & Deposit summary */}
                    <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>إجمالي ثمن الأسماك:</span>
                        <span className="font-bold">{order.subtotal} جنيه</span>
                      </div>
                      {order.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>خصم الكوبون ({order.couponCode}):</span>
                          <span>-{order.discountAmount} جنيه</span>
                        </div>
                      )}
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>التوصيل:</span>
                        <span>مجاناً 🚚</span>
                      </div>
                      <div className="flex justify-between font-black border-t border-slate-200 dark:border-slate-700 pt-1">
                        <span>المبلغ الإجمالي الكلي:</span>
                        <span>{order.total} جنيه</span>
                      </div>
                      <div className="flex justify-between text-cyan-700 dark:text-cyan-300 font-bold">
                        <span>العربون ({order.depositStatus === 'confirmed' ? 'مؤكد ✓' : 'قيد المراجعة'}):</span>
                        <span>{order.depositPaid} جنيه</span>
                      </div>
                      <div className="flex justify-between text-amber-600 dark:text-amber-400 font-black">
                        <span>المتبقي للدليفري عند الاستلام:</span>
                        <span>{order.remainingAmount} جنيه</span>
                      </div>
                    </div>

                    {/* Delivery & Customer Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-slate-400 block font-medium text-[10px]">عنوان التوصيل:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5">
                          {order.governorate} - {order.city}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px]">{order.address}</p>
                      </div>

                      <div>
                        <span className="text-slate-400 block font-medium text-[10px]">بيانات العميل والتحويل:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5">{order.customerName}</p>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px]">هاتف: {order.customerPhone}</p>
                        {order.depositTransactionRef && (
                          <p className="text-cyan-700 dark:text-cyan-400 text-[11px] font-bold mt-0.5">
                            رقم المحول منه: {order.depositTransactionRef}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions: Re-order / WhatsApp Help */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        onClick={() => reOrder(order)}
                        className="flex-1 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة طلب هذه الأسماك 🔁</span>
                      </button>

                      <a
                        href={getWhatsAppLink(storeSettings.whatsappNumber, `مرحباً متجر الملاح، استفسار ومساعدة بخصوص الطلب ${order.orderNumber}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>واتساب للمساعدة</span>
                      </a>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
});
