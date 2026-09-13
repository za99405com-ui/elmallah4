import React, { useState, useMemo } from 'react';
import { 
  User, 
  Moon, 
  Sun, 
  MapPin, 
  Phone, 
  Shield, 
  Clock, 
  HelpCircle, 
  LogOut, 
  Check, 
  Lock, 
  ExternalLink,
  ChevronLeft,
  Sparkles,
  Store,
  MessageCircle,
  History,
  RotateCcw,
  PackageCheck,
  Search,
  Receipt,
  Printer,
  X,
  ShoppingBag
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getWhatsAppLink } from '../utils/whatsapp';
import { Order } from '../types';

export const SettingsView: React.FC = React.memo(() => {
  const { 
    currentUser, 
    loginUser, 
    registerUser, 
    updateUserAccount, 
    logoutUser,
    theme, 
    toggleTheme, 
    setActiveTab, 
    storeSettings,
    cutoffInfo,
    regions,
    orders,
    reOrder
  } = useStore();

  // Auth form state if not logged in
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState<string>(currentUser?.name || '');
  const [phone, setPhone] = useState<string>(currentUser?.phone || '');
  const [governorate, setGovernorate] = useState<string>(currentUser?.governorate || (regions[0]?.governorate || 'القاهرة'));
  const [city, setCity] = useState<string>(currentUser?.city || (regions[0]?.cities[0] || 'مدينة نصر'));
  const [address, setAddress] = useState<string>(currentUser?.address || '');
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);

  // History (السجل) state
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [selectedHistoryReceipt, setSelectedHistoryReceipt] = useState<Order | null>(null);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string>('');

  const deliveredOrders = useMemo(() => {
    return orders.filter(o => o.status === 'delivered');
  }, [orders]);

  const filteredHistoryOrders = useMemo(() => {
    if (!historySearch.trim()) return deliveredOrders;
    const q = historySearch.toLowerCase();
    return deliveredOrders.filter(o => 
      o.orderNumber.toLowerCase().includes(q) ||
      o.items.some(item => item.productName.toLowerCase().includes(q))
    );
  }, [deliveredOrders, historySearch]);

  const handleReorderClick = (order: Order) => {
    reOrder(order);
    setReorderSuccessMsg(`تمت إضافة منتجات الطلب #${order.orderNumber} إلى السلة!`);
    setTimeout(() => {
      setReorderSuccessMsg('');
      setShowHistoryModal(false);
      setActiveTab('cart');
    }, 1200);
  };

  const currentRegion = useMemo(() => {
    return regions.find(r => r.governorate === governorate) || regions[0];
  }, [regions, governorate]);

  const availableCities = currentRegion ? currentRegion.cities : [];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    if (currentUser) {
      updateUserAccount({
        name,
        phone,
        governorate,
        city,
        address
      });
    } else {
      if (authMode === 'register') {
        registerUser({
          name: name || 'عميل الملاح',
          phone,
          governorate,
          city,
          address
        });
      } else {
        loginUser(phone, name);
      }
    }

    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto py-3 px-3 sm:px-4 space-y-4">
      
      {/* Title */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>حسابي والإعدادات</span>
          <span className="text-base">⚙️</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
          إدارة بياناتك الشخصية وعناوين التوصيل والوضع الليلي وإعدادات المتجر
        </p>
      </div>

      {/* History / Completed Orders Card (السجل) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 flex items-center justify-center text-cyan-700 dark:text-cyan-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">سجل الطلبات المسلمة (السجل)</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300">
                {deliveredOrders.length} طلب
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              استعراض فواتير طلباتك السابقة التي تم استلامها وإعادة طلبها بضغطة زر
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowHistoryModal(true)}
          id="open-history-btn"
          className="px-3.5 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>عرض السجل</span>
        </button>
      </div>

      {/* Dark Mode Quick Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-amber-400">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">المظهر (Dark Mode)</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              {theme === 'dark' ? 'الوضع الليلي مفعّل' : 'الوضع النهاري مفعّل'}
            </p>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          id="theme-toggle-btn"
          className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>تبديل للنهاري</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-slate-700" />
              <span>تبديل لليلي</span>
            </>
          )}
        </button>
      </div>

      {/* Daily Cutoff Info Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
          <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span>سياسة موعد إغلاق الطلبات اليومي</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
          نستقبل طلبات اليوم حتى <strong>الساعة {cutoffInfo.cutoffTimeString}</strong>. الطلبات بعد هذا الموعد تُحسب تلقائياً لطلبات الغد لنضمن لك سمكاً طازجاً من صيد الفجر مباشرة.
        </p>
      </div>

      {/* User Profile / Auth Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              {currentUser ? 'بياناتي المسجلة' : 'تسجيل الدخول / إنشاء حساب'}
            </h3>
          </div>

          {currentUser && (
            <button
              onClick={logoutUser}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل خروج</span>
            </button>
          )}
        </div>

        {!currentUser && (
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-xs font-bold">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                authMode === 'login' 
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' 
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              دخول سريع برقم الهاتف
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                authMode === 'register' 
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' 
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              حساب جديد
            </button>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                الاسم الكريم:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="أحمد محمد"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                رقم الهاتف (للتواصل والتوصيل): <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010xxxxxxxx"
                dir="ltr"
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white text-right focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                المحافظة:
              </label>
              <select
                value={governorate}
                onChange={(e) => {
                  const newGov = e.target.value;
                  setGovernorate(newGov);
                  const matched = regions.find(r => r.governorate === newGov);
                  if (matched && matched.cities.length > 0) {
                    setCity(matched.cities[0]);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                {regions.map((reg) => (
                  <option key={reg.id} value={reg.governorate}>
                    {reg.governorate} ({reg.deliveryFee} ج توصيل)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                المنطقة / الحي:
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
              العنوان التفصيلي:
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="اسم الشارع، رقم العمارة، الشقة..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSavedNotice ? (
              <>
                <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-700" />
                <span>تم حفظ البيانات بنجاح ✓</span>
              </>
            ) : (
              <span>{currentUser ? 'تحديث وحفظ بياناتي' : 'تسجيل وحفظ البيانات'}</span>
            )}
          </button>
        </form>
      </div>

      {/* Support & Hotline */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-center space-y-3 text-xs text-slate-600 dark:text-slate-400">
        <p className="font-bold text-slate-800 dark:text-slate-200">متجر الملاح للأسماك الطازجة 🐟</p>
        <div>
          <a
            href={getWhatsAppLink(storeSettings.whatsappNumber, 'مرحباً متجر الملاح، أحتاج مساعدة أو استفسار')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>واتساب للمساعدة</span>
          </a>
        </div>
        <p className="text-[11px] text-slate-400">تطبيق الملاح © 2026 - أسماك طازجة صيد اليوم</p>
      </div>

      {/* History (السجل) Modal */}
      {showHistoryModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-right my-auto max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">سجل الطلبات المسلمة</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">عرض كافة الطلبات التي تم توصيلها واستلامها</p>
                </div>
              </div>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification when re-ordering */}
            {reorderSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{reorderSuccessMsg}</span>
              </div>
            )}

            {/* Search Bar */}
            {deliveredOrders.length > 0 && (
              <div className="relative">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="بحث في السجل برقم الطلب أو اسم السمك..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            )}

            {/* Orders List Container */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1 pl-1">
              {filteredHistoryOrders.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {historySearch ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد طلبات مسلمة حتى الآن'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    {historySearch 
                      ? 'جرب البحث برقم طلب آخر أو اسم نوع سمك مختلف'
                      : 'بمجرد أن يقوم المندوب بتسليم طلبك وتأكيد استلامه، سيظهر تلقائياً هنا في السجل للرجوع إليه وإعادة طلبه في أي وقت.'
                    }
                  </p>
                  <button
                    onClick={() => {
                      setShowHistoryModal(false);
                      setActiveTab('home');
                    }}
                    className="mt-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                  >
                    تسوق الأسماك الطازجة الآن
                  </button>
                </div>
              ) : (
                filteredHistoryOrders.map((order) => (
                  <div 
                    key={order.id}
                    className="bg-slate-50 dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 space-y-3 shadow-2xs"
                  >
                    {/* Top Row: Order number & Date & Status */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-200/50 dark:border-cyan-800/40">
                          #{order.orderNumber}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('ar-EG', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                        <Check className="w-3 h-3" />
                        <span>تم التسليم</span>
                      </span>
                    </div>

                    {/* Items preview */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <span className="font-medium">
                            {item.productName} {item.variantLabel ? <span className="text-cyan-600 dark:text-cyan-400 font-bold">[{item.variantLabel}]</span> : ''} <span className="text-slate-400 text-[11px]">({item.quantity} {item.unit})</span>
                          </span>
                          <span className="font-bold">{item.itemTotal} ج</span>
                        </div>
                      ))}

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>إجمالي الفاتورة:</span>
                        <span className="text-cyan-700 dark:text-cyan-400 font-black">{order.total} جنيه</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleReorderClick(order)}
                        className="flex-1 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة طلب هذه الأصناف</span>
                      </button>

                      <button
                        onClick={() => setSelectedHistoryReceipt(order)}
                        className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="عرض الفاتورة كاملة"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>الفاتورة</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Order Receipt Modal in Settings */}
      {selectedHistoryReceipt && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto"
          onClick={() => setSelectedHistoryReceipt(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-900 my-auto text-right space-y-4 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-black text-lg text-slate-950">فاتورة طلب سابق 🐟</h2>
                <p className="text-xs text-slate-500 font-mono">متجر الملاح - رقم: {selectedHistoryReceipt.orderNumber}</p>
              </div>
              <button
                onClick={() => setSelectedHistoryReceipt(null)}
                className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-1 text-slate-700">
              <p><strong>العميل:</strong> {selectedHistoryReceipt.customerName}</p>
              <p><strong>الهاتف:</strong> {selectedHistoryReceipt.customerPhone}</p>
              <p><strong>العنوان:</strong> {selectedHistoryReceipt.governorate} - {selectedHistoryReceipt.city} - {selectedHistoryReceipt.address}</p>
              <p><strong>تاريخ الطلب:</strong> {new Date(selectedHistoryReceipt.createdAt).toLocaleString('ar-EG')}</p>
              <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                حالة الطلب: تم التسليم والاستلام بنجاح ✓
              </div>
            </div>

            <div className="border-t border-b py-2 space-y-1.5 text-xs">
              {selectedHistoryReceipt.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.productName} ({it.quantity} {it.unit})</span>
                  <span className="font-bold">{it.itemTotal} ج</span>
                </div>
              ))}
              <div className="flex justify-between text-emerald-600 font-bold pt-1">
                <span>التوصيل:</span>
                <span>مجاناً 🚚</span>
              </div>
              {selectedHistoryReceipt.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>خصم الكوبون ({selectedHistoryReceipt.couponCode}):</span>
                  <span>-{selectedHistoryReceipt.discountAmount} ج</span>
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between font-black text-sm text-slate-950">
                <span>الإجمالي الكلي:</span>
                <span>{selectedHistoryReceipt.total} جنيه</span>
              </div>
              <div className="flex justify-between text-cyan-800 font-bold">
                <span>العربون المدفوع:</span>
                <span>{selectedHistoryReceipt.depositPaid} جنيه</span>
              </div>
              <div className="flex justify-between text-slate-700 font-bold">
                <span>المبلغ المستلم عند التسليم:</span>
                <span>{selectedHistoryReceipt.remainingAmount} جنيه</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الفاتورة</span>
              </button>
              <button
                onClick={() => {
                  const o = selectedHistoryReceipt;
                  setSelectedHistoryReceipt(null);
                  handleReorderClick(o);
                }}
                className="px-4 py-2 bg-cyan-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة الطلب</span>
              </button>
              <button
                onClick={() => setSelectedHistoryReceipt(null)}
                className="px-3 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
