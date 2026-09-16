import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { api, PaymentSession } from '../utils/api';

interface PaymentSessionErrorDetail {
  order?: { orderNumber?: string };
  error?: string;
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const secs = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

export const RealtimePaymentOverlay: React.FC = () => {
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorOrderNumber, setErrorOrderNumber] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [contactingSupport, setContactingSupport] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  useEffect(() => {
    const onStarted = (event: Event) => {
      const detail = (event as CustomEvent<PaymentSession>).detail;
      if (!detail) return;
      setError(null);
      setErrorOrderNumber(null);
      setSession(detail);
    };

    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<PaymentSession>).detail;
      if (!detail) return;
      setSession((previous) => previous ? { ...previous, ...detail } : detail);
    };

    const onEnded = () => {
      window.setTimeout(() => setSession(null), 500);
    };

    const onError = (event: Event) => {
      const detail = (event as CustomEvent<PaymentSessionErrorDetail>).detail;
      setSession(null);
      setError(detail?.error || 'تم تسجيل الطلب، لكن تعذر تخصيص جهاز دفع حالياً.');
      setErrorOrderNumber(detail?.order?.orderNumber || null);
    };

    window.addEventListener('almallah:payment-session-started', onStarted);
    window.addEventListener('almallah:payment-session-updated', onUpdated);
    window.addEventListener('almallah:payment-session-ended', onEnded);
    window.addEventListener('almallah:payment-session-error', onError);

    return () => {
      window.removeEventListener('almallah:payment-session-started', onStarted);
      window.removeEventListener('almallah:payment-session-updated', onUpdated);
      window.removeEventListener('almallah:payment-session-ended', onEnded);
      window.removeEventListener('almallah:payment-session-error', onError);
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    const update = () => {
      setRemainingSeconds(
        Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
      );
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.expiresAt]);

  const providerLabel = useMemo(() => {
    if (!session) return '';
    return session.provider === 'vf_cash' ? 'Vodafone Cash' : 'البنك الأهلي / تحويل بنكي';
  }, [session]);

  const copyDestination = async () => {
    if (!session?.paymentDestination) return;
    try {
      await navigator.clipboard.writeText(session.paymentDestination);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable in embedded browsers; destination remains selectable.
    }
  };

  const contactSupport = async () => {
    if (!session || contactingSupport) return;
    setContactingSupport(true);
    setSupportError(null);
    const result = await api.contactPaymentSupport(session);
    if (result.success && result.data) {
      setSession(result.data);
    } else {
      setSupportError(result.error || 'تعذر تسجيل طلب المراجعة. حاول مرة أخرى.');
    }
    setContactingSupport(false);
  };

  if (!session && !error) return null;

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 shadow-2xl p-5 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="mt-3 text-lg font-black text-slate-900 dark:text-white">الطلب مسجل — الدفع يحتاج متابعة</h2>
          {errorOrderNumber && <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300 mt-1">رقم الطلب: {errorOrderNumber}</p>}
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">{error}</p>
          <button onClick={() => setError(null)} className="mt-4 w-full rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 py-2.5 font-black text-sm">متابعة</button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const waiting = session.status === 'waiting';
  const paid = session.status === 'paid';
  const expired = session.status === 'expired';
  const review = session.status === 'needs_review' || session.status === 'expired_needs_review';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" dir="rtl">
      <div className="w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${paid ? 'bg-emerald-500/15 text-emerald-600' : review ? 'bg-amber-500/15 text-amber-600' : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'}`}>
                {paid ? <CheckCircle2 className="w-7 h-7" /> : review ? <AlertTriangle className="w-7 h-7" /> : <Smartphone className="w-7 h-7" />}
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {paid ? 'تم تأكيد الدفع والطلب' : review ? 'الدفع تحت المراجعة' : expired ? 'انتهت مهلة الدفع' : 'حوّل العربون الآن'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{providerLabel} · تأكيد لحظي من السيرفر</p>
              </div>
            </div>
            {!waiting && !paid && (
              <button onClick={() => setSession(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="إغلاق">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {waiting && (
            <div className="rounded-2xl bg-slate-950 text-white p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-300 text-xs font-bold">
                <Clock3 className="w-4 h-4" /> الوقت المتبقي
              </div>
              <div dir="ltr" className={`font-mono text-4xl font-black tracking-wider mt-1 ${remainingSeconds <= 20 ? 'text-rose-400' : 'text-cyan-300'}`}>
                {formatCountdown(remainingSeconds)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">المهلة محسوبة من السيرفر — الافتراضي دقيقتان</p>
            </div>
          )}

          <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900 bg-cyan-50/60 dark:bg-cyan-950/30 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">حوّل إلى الرقم / الحساب المخصص لهذه الجلسة فقط:</div>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
              <strong dir="ltr" className="font-mono text-xl sm:text-2xl tracking-wider text-slate-950 dark:text-white select-all break-all">
                {session.paymentDestination || 'جارٍ التخصيص...'}
              </strong>
              <button onClick={copyDestination} disabled={!session.paymentDestination} className="shrink-0 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-black flex items-center gap-1 disabled:opacity-50">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'تم' : 'نسخ'}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-700 dark:text-slate-300">المبلغ المطلوب:</span>
              <strong className="text-xl font-black text-cyan-800 dark:text-cyan-300">{Number(session.expectedAmount).toFixed(2)} ج.م</strong>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-white mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> لا تحتاج كتابة Transaction Reference
            </div>
            المطابقة تتم على السيرفر باستخدام الجهاز المحجوز، وقت التحويل، المبلغ التقريبي، ورقم المرسل في Vodafone Cash إذا كان متاحاً.
          </div>

          {waiting && (
            <div className="flex items-center justify-center gap-2 text-xs text-cyan-700 dark:text-cyan-300 font-bold">
              <Loader2 className="w-4 h-4 animate-spin" /> ننتظر إشعار الدفع من الجهاز المخصص...
            </div>
          )}

          {paid && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-8 h-8 mx-auto" />
              <div className="font-black mt-1">تم التأكيد من admin3</div>
              {session.matchedAmount != null && <div className="text-xs mt-1">المبلغ المستلم: {Number(session.matchedAmount).toFixed(2)} ج.م</div>}
              {session.amountDifference != null && Number(session.amountDifference) !== 0 && <div className="text-xs">فرق مسجل: {Number(session.amountDifference).toFixed(2)} ج.م</div>}
              <div className="text-xs mt-2">سيتم نقلك تلقائياً إلى صفحة تم تأكيد الطلب.</div>
            </div>
          )}

          {review && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 text-amber-800 dark:text-amber-300 text-sm">
              <div className="font-black">تم وضع العملية في قائمة المراجعة.</div>
              <div className="text-xs mt-1">لن يعتبر التطبيق الدفع مؤكداً من تلقاء نفسه؛ فريق الإدارة يراجع الحالة من admin3.</div>
            </div>
          )}

          {expired && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-700 dark:text-rose-300 text-sm">
                انتهت مهلة الجلسة ولم يصل تأكيد مطابق حتى الآن. إذا كنت قد حولت بالفعل، سجّل الحالة لخدمة العملاء حتى لا تضيع العملية.
              </div>
              <button
                onClick={contactSupport}
                disabled={contactingSupport}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {contactingSupport ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                تواصل مع خدمة العملاء — لقد قمت بالتحويل
              </button>
              {supportError && <p className="text-xs text-rose-600 text-center">{supportError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
