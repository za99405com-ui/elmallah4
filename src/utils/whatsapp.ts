/**
 * Helper to build valid WhatsApp (wa.me) links
 * Ensures Egyptian numbers starting with '0' (e.g. 01015192040) are formatted to '201015192040'
 */
export function getWhatsAppLink(
  phone: string = '01015192040',
  message: string = 'مرحباً متجر الملاح، أحتاج مساعدة أو استفسار'
): string {
  const digits = (phone || '01015192040').replace(/\D/g, '');
  let fullNumber = digits;

  if (digits.startsWith('0')) {
    fullNumber = '20' + digits.substring(1);
  } else if (!digits.startsWith('20')) {
    fullNumber = '20' + digits;
  }

  const encoded = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${fullNumber}${encoded}`;
}
