// Helper utilities for calculating delivery date based on the 3:00 AM cutoff rule

export interface CutoffCalculation {
  isBeforeCutoff: boolean;
  deliveryDate: Date;
  deliveryDateString: string;
  deliveryDayName: string;
  cutoffTimeString: string;
  hoursRemaining: number;
  minutesRemaining: number;
  badgeLabel: string;
  detailedMessage: string;
}

export function calculateDeliveryCutoff(cutoffHour: number = 3, cutoffMinute: number = 0): CutoffCalculation {
  const now = new Date();
  
  // Cutoff time today
  const cutoffToday = new Date(now);
  cutoffToday.setHours(cutoffHour, cutoffMinute, 0, 0);

  const isBeforeCutoff = now.getTime() < cutoffToday.getTime();

  // Delivery date calculation:
  // If before 3:00 AM -> Delivery is TODAY
  // If at or after 3:00 AM -> Delivery is TOMORROW
  const deliveryDate = new Date(now);
  if (!isBeforeCutoff) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
  }

  const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const deliveryDayName = daysArabic[deliveryDate.getDay()];
  
  const deliveryDateString = deliveryDate.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate remaining time until next cutoff
  let nextCutoff = new Date(now);
  if (now.getTime() >= cutoffToday.getTime()) {
    nextCutoff.setDate(nextCutoff.getDate() + 1);
  }
  nextCutoff.setHours(cutoffHour, cutoffMinute, 0, 0);

  const diffMs = nextCutoff.getTime() - now.getTime();
  const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const formatCutoffTime = `${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour === 0 ? 12 : cutoffHour}:${cutoffMinute.toString().padStart(2, '0')} ${cutoffHour >= 12 ? 'م' : 'ص'}`;

  const badgeLabel = isBeforeCutoff ? 'التسليم اليوم 🚚' : 'التسليم غداً 🚚';
  
  const detailedMessage = isBeforeCutoff
    ? `طلبك الآن سيتم تسليمه اليوم (${deliveryDayName}). متبقي ${hoursRemaining} س و ${minutesRemaining} د على إغلاق طلبات اليوم (الساعة ${formatCutoffTime}).`
    : `طلبك الآن يُحسب لطلبات الغد (${deliveryDayName}) لتجاوز موعد إغلاق اليوم (${formatCutoffTime}).`;

  return {
    isBeforeCutoff,
    deliveryDate,
    deliveryDateString,
    deliveryDayName,
    cutoffTimeString: formatCutoffTime,
    hoursRemaining,
    minutesRemaining,
    badgeLabel,
    detailedMessage
  };
}
