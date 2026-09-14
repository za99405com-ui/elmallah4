import React from 'react';
import { Printer, X, Check, Phone, MapPin, Calendar, Clock, ShoppingBag } from 'lucide-react';
import { Order, getPaymentMethodLabel } from '../types';

interface ThermalReceiptProps {
  order: Order | null;
  onClose: () => void;
  storeName?: string;
  storePhone?: string;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  order,
  onClose,
  storeName = 'متجر الملاح للأسماك الطازجة',
  storePhone = '01015192040'
}) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Container - on screen it is a nice modal; on print it is 80mm thermal receipt */}
      <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-200 text-slate-950 text-right space-y-3 font-mono print:max-w-none print:w-[80mm] print:border-none print:shadow-none print:p-2 print:m-0 print:text-black">
        
        {/* Screen Header Controls (Hidden during print) */}
        <div className="flex items-center justify-between border-b pb-2.5 print:hidden">
          <div className="flex items-center gap-1.5 text-slate-800">
            <Printer className="w-4 h-4 text-cyan-600" />
            <span className="font-bold font-sans text-xs">معاينة إيصال الطابعة الحرارية (80mm)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= THERMAL RECEIPT BODY ================= */}
        <div id="thermal-receipt-content" className="space-y-2 text-xs leading-tight">
          
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-slate-400 pb-2 space-y-1">
            <h1 className="text-base font-black tracking-tight">{storeName}</h1>
            <p className="text-[11px] font-bold">صيد اليوم طازج 100% 🐟</p>
            <p className="text-[10px]">خدمة العملاء: {storePhone}</p>
            <div className="text-[11px] font-black bg-slate-100 px-2 py-0.5 rounded print:bg-transparent">
              كود الطلب: {order.orderNumber}
            </div>
            <p className="text-[10px] text-slate-600">
              التاريخ: {new Date(order.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>

          {/* Customer & Delivery Pilot Info */}
          <div className="border-b border-dashed border-slate-300 py-1.5 space-y-1 text-[11px]">
            <p className="font-bold flex items-center justify-between">
              <span>العميل:</span>
              <span className="font-black text-xs">{order.customerName}</span>
            </p>
            <p className="flex items-center justify-between">
              <span>الهاتف:</span>
              <span className="font-bold font-mono tracking-wider">{order.customerPhone}</span>
            </p>
            <p className="text-[10px] leading-tight">
              <span className="font-bold">العنوان: </span>
              <span>{order.governorate} - {order.city} - {order.address}</span>
            </p>
            {order.notes && (
              <div className="p-1.5 bg-slate-100 rounded text-[10px] font-bold border border-slate-200 mt-1 print:border-black print:bg-white">
                <span>تعليمات التجهيز والتنظيف: </span>
                <span className="text-slate-900 font-sans">{order.notes}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-1">
            <div className="grid grid-cols-12 font-black border-b border-black pb-1 text-[11px]">
              <span className="col-span-6">الصنف</span>
              <span className="col-span-3 text-center">الكمية</span>
              <span className="col-span-3 text-left">الإجمالي</span>
            </div>

            <div className="divide-y divide-slate-200 border-b border-black py-1 space-y-1">
              {order.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 text-[11px] pt-1">
                  <div className="col-span-6 leading-tight">
                    <span className="font-bold">{it.productName}</span>
                    {it.piecesPerKiloRange && (
                      <span className="block text-[9px] text-slate-500 print:text-black">
                        ({it.piecesPerKiloRange})
                      </span>
                    )}
                  </div>
                  <span className="col-span-3 text-center font-bold">
                    {it.quantity} {it.unit}
                  </span>
                  <span className="col-span-3 text-left font-black">
                    {it.itemTotal} ج
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-1 text-[11px] pt-1">
            <div className="flex justify-between">
              <span>المجموع الفرعي:</span>
              <span className="font-bold">{order.subtotal} ج.م</span>
            </div>
            
            <div className="flex justify-between">
              <span>رسوم التوصيل:</span>
              <span className="font-bold">{order.deliveryFee > 0 ? `${order.deliveryFee} ج.م` : 'مجاناً 🚚'}</span>
            </div>

            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold print:text-black">
                <span>خصم الكوبون ({order.couponCode || ''}):</span>
                <span>-{order.discountAmount} ج.م</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black border-t-2 border-dashed border-black pt-1">
              <span>إجمالي الفاتورة:</span>
              <span>{order.total} ج.م</span>
            </div>

            {/* Deposit info */}
            {order.depositPaid > 0 && (
              <div className="flex justify-between text-[11px] font-bold text-cyan-800 print:text-black">
                <span>العربون المدفوع مسبقاً ({order.depositStatus}):</span>
                <span>-{order.depositPaid} ج.م</span>
              </div>
            )}

            {/* Final Cash amount for delivery rider */}
            <div className="bg-black text-white p-2 rounded-lg text-center my-2 print:bg-white print:text-black print:border-2 print:border-black">
              <span className="block text-[10px] font-sans font-bold">المطلوب تحصيله من العميل بواسطة الطيار:</span>
              <span className="text-base font-black font-mono">
                {order.remainingAmount !== undefined ? order.remainingAmount : order.total} ج.م
              </span>
            </div>

            <div className="text-center text-[10px] pt-2 border-t border-dashed border-slate-300 space-y-0.5">
              <p className="font-bold">طريقة الدفع: {getPaymentMethodLabel(order.paymentMethod, order.rawPaymentMethod)}</p>
              <p>شكراً لثقتكم في متجر الملاح 🐟</p>
              <p className="text-[9px] text-slate-500 print:text-black">صيد اليوم طازج - يرجى فحص الطلب بحضور المندوب</p>
            </div>
          </div>
        </div>

        {/* Screen Action Buttons (Hidden during print) */}
        <div className="flex gap-2 pt-3 border-t print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold font-sans text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الإيصال فوراً</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold font-sans text-xs rounded-xl cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
