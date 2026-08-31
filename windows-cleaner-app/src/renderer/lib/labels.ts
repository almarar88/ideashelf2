export const CLEANER_CATEGORY_LABELS: Record<string, { title: string; desc: string }> = {
  'cleaner.userTemp': { title: 'الملفات المؤقتة للمستخدم', desc: 'ملفات مؤقتة تتركها البرامج أثناء عملها' },
  'cleaner.windowsTemp': { title: 'ملفات ويندوز المؤقتة', desc: 'مجلد Temp الخاص بنظام ويندوز' },
  'cleaner.prefetch': { title: 'ذاكرة التسريع Prefetch', desc: 'يعيد ويندوز بناءها تلقائيًا، آمن غالبًا لكن قد يبطئ أول إقلاع لبرنامج' },
  'cleaner.windowsUpdate': { title: 'ملفات تنزيل تحديثات ويندوز', desc: 'نسخ محدّثات تم تثبيتها بالفعل' },
  'cleaner.thumbnails': { title: 'ذاكرة الصور المصغّرة', desc: 'يعيد ويندوز إنشاءها عند الحاجة' },
  'cleaner.errorReports': { title: 'تقارير أعطال ويندوز', desc: 'ملفات تشخيص أعطال قديمة' },
  'cleaner.recentList': { title: 'قائمة الملفات الأخيرة', desc: 'اختصارات لآخر الملفات المفتوحة' },
  'cleaner.chromeCache': { title: 'ذاكرة تخزين Chrome المؤقتة', desc: 'يُعاد بناؤها تلقائيًا عند تصفح المواقع' },
  'cleaner.edgeCache': { title: 'ذاكرة تخزين Edge المؤقتة', desc: 'يُعاد بناؤها تلقائيًا عند تصفح المواقع' },
  'cleaner.firefoxCache': { title: 'ذاكرة تخزين Firefox المؤقتة', desc: 'يُعاد بناؤها تلقائيًا عند تصفح المواقع' },
  'cleaner.deliveryOptimization': { title: 'ملفات تحسين التسليم', desc: 'أجزاء تحديثات مشتركة بين الأجهزة على الشبكة' },
  'cleaner.minidumps': { title: 'ملفات تفريغ الذاكرة (Minidump)', desc: 'ملفات تشخيص أعطال النظام' },
  'cleaner.recycleBin': { title: 'سلة المحذوفات', desc: 'إفراغ سلة المحذوفات نهائيًا — غير قابل للتراجع' }
}

export function categoryLabel(key: string): { title: string; desc: string } {
  return CLEANER_CATEGORY_LABELS[key] ?? { title: key, desc: '' }
}

/**
 * معرّف الفئة كما يُخزَّن في سجل التنظيف → مفتاح الاسم المعروض.
 * صريح لا مشتق بتحويل الأحرف، لأن بعض المعرّفات لا تطابق مفاتيحها
 * (windows_update_cache مقابل windowsUpdate مثلاً).
 */
const CATEGORY_ID_TO_LABEL_KEY: Record<string, string> = {
  user_temp: 'cleaner.userTemp',
  windows_temp: 'cleaner.windowsTemp',
  prefetch: 'cleaner.prefetch',
  windows_update_cache: 'cleaner.windowsUpdate',
  thumbnail_cache: 'cleaner.thumbnails',
  windows_error_reports: 'cleaner.errorReports',
  recent_list: 'cleaner.recentList',
  chrome_cache: 'cleaner.chromeCache',
  edge_cache: 'cleaner.edgeCache',
  firefox_cache: 'cleaner.firefoxCache',
  delivery_optimization: 'cleaner.deliveryOptimization',
  minidumps: 'cleaner.minidumps',
  recycle_bin: 'cleaner.recycleBin'
}

export function categoryTitleById(categoryId: string): string {
  const key = CATEGORY_ID_TO_LABEL_KEY[categoryId]
  return key ? categoryLabel(key).title : categoryId
}
