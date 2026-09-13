import React from 'react';
import { ShieldCheck, Clock, Award, MessageCircle, MapPin } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getWhatsAppLink } from '../utils/whatsapp';

export const AboutPage: React.FC = React.memo(() => {
  const { setActiveTab } = useStore();

  return (
    <div className="max-w-3xl mx-auto py-4 px-3 sm:px-4 space-y-4">
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-2xs">
          🐟
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">عن متجر الملاح للأسماك</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs max-w-lg mx-auto font-medium">
          متخصصون حصرياً في توريد الأسماك الطازجة صيد اليوم من البحر إلى باب منزلك
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-xs sm:text-sm">
        <p>
          تأسس <strong className="text-slate-900 dark:text-white">متجر الملاح</strong> برؤية واضحة ومباشرة: <em>"توصيل أجود أنواع الأسماك البحرية الطازجة بدون أي إضافات أو تجميد، مباشرة من شباك الصيد لمائدتك"</em>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
              <span>🌊 صيد بحري طازة 100%</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
              نتعامل مباشرة مع موانئ السويس وبورسعيد والإسكندرية لتوفير أسماك طازجة يومياً خالية من أي تجميد.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
              <span>❄️ تغليف وحفظ مبرد</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
              تصلك الأسماك معبأة داخل عبوات محكمة مع ثلج هلامي لحفظ درجة الحرارة والطزاجة حتى الاستلام.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          نظامنا اليومي يستقبل الطلبات حتى <strong>3:00 فجراً</strong> لتصلك في اليوم نفسه طازجة فور خروج الصيد.
        </p>

        <div className="pt-2 text-center">
          <button
            onClick={() => setActiveTab('products')}
            className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            تصفح أسماك اليوم الطازجة 🐟
          </button>
        </div>
      </div>
    </div>
  );
});

export const DeliveryPolicyPage: React.FC = React.memo(() => {
  return (
    <div className="max-w-3xl mx-auto py-4 px-3 sm:px-4 space-y-4">
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-2xs">
          🚚
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">سياسة مواعيد الطلب والتوصيل</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs max-w-lg mx-auto font-medium">
          قواعد موعد إغلاق 3:00 ص وسلسلة التبريد المعتمدة لضمان أقصى طزاجة
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed text-xs sm:text-sm">
        
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">موعد إغلاق طلبات اليوم (الساعة 3:00 فجراً)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                الطلبات المسجلة قبل 3:00 ص تُجهز وتسلم في نفس اليوم. الطلبات بعد 3:00 ص تحسب تلقائياً لليوم التالي لضمان جلبها طازجة من صيد الفجر.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">سلسلة التبريد المحكمة (Cold-Chain)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                توضع الأسماك داخل أكياس حرارية محكمة الإغلاق مع أكياس ثلج هلامي (Gel Ice) داخل حقائب تبريد مخصصة لضمان بقاء درجة الحرارة تحت 4 درجات مئوية.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">ضمان المعاينة قبل الدفع</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                يحق للعميل فتح العبوة ومعاينة الأسماك مع المندوب للتأكد من الطزاجة التامة قبل سداد المبلغ.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-xs space-y-1">
          <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-1.5">
            <span>🚚 التوصيل مجاني لجميع المناطق</span>
          </h4>
          <p className="text-emerald-800 dark:text-emerald-300">
            يسر متجر الملاح تقديم خدمة التوصيل المبرد مجاناً لكافة المحافظات والمناطق المدعومة (القاهرة، الجيزة، الإسكندرية، مدن القناة).
          </p>
        </div>

      </div>
    </div>
  );
});

export const ContactPage: React.FC = React.memo(() => {
  const { storeSettings } = useStore();

  return (
    <div className="max-w-2xl mx-auto py-4 px-3 sm:px-4 space-y-4">
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-2xs">
          💬
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">تواصل مع متجر الملاح</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs max-w-lg mx-auto font-medium">
          فريق خدمة العملاء متواجد على مدار اليوم لتلقي استفساراتكم وحجوزاتكم حصرياً عبر تطبيق واتساب
        </p>
      </div>

      <div className="space-y-3">
        
        {/* WhatsApp Card */}
        <a
          href={getWhatsAppLink(storeSettings.whatsappNumber, 'مرحباً متجر الملاح، أحتاج مساعدة أو استفسار')}
          target="_blank"
          rel="noreferrer"
          className="bg-emerald-50 dark:bg-emerald-950/40 text-slate-900 dark:text-white rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800/80 shadow-xs flex flex-col justify-between space-y-4 cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 px-3 py-1 rounded-lg">
              رد فوري ومباشر للمساعدة 🟢
            </span>
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <MessageCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">خدمة المساعدة والدعم عبر واتساب</h3>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              فريق المساعدة متواجد للرد على كافة استفساراتكم ومساعدتكم مباشرة على تطبيق واتساب. اضغط هنا لبدء المحادثة الفورية.
            </p>
          </div>
          <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <span className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-bold">تواصل مباشر:</span>
            <span className="text-sm sm:text-base font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <span>فتح واتساب للمساعدة</span>
              <span>💬</span>
            </span>
          </div>
        </a>

      </div>
    </div>
  );
});
