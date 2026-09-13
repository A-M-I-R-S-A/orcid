INSERT INTO `page_sections` (`page_id`,`kind`,`name`,`config`,`background`,`spacing`,`is_visible`,`sort_order`)
SELECT p.id, seed.kind, seed.name, JSON_OBJECT('slot', seed.slot, 'locked', TRUE), seed.background, seed.spacing, TRUE, seed.sort_order
FROM `pages` p
JOIN (
  SELECT 'about' slug,'about.hero' slot,'hero' kind,'هدر درباره ارکید' name,'plain' background,'none' spacing,10 sort_order UNION ALL
  SELECT 'about','about.stats','features','آمار ارکید','plain','sm',20 UNION ALL SELECT 'about','about.story','rich_text','داستان ارکید','plain','md',30 UNION ALL SELECT 'about','about.pillars','features','قول‌ها و ارزش‌ها','sunken','md',40 UNION ALL SELECT 'about','about.policies','cards','ارسال و بازگشت','plain','md',50 UNION ALL SELECT 'about','about.related','cards','صفحه‌های مرتبط','plain','md',60 UNION ALL SELECT 'about','about.closing','cta','دعوت پایانی','plain','md',70 UNION ALL
  SELECT 'contact','contact.hero','hero','هدر تماس با ما','plain','none',10 UNION ALL SELECT 'contact','contact.channels','cards','راه‌های ارتباطی','plain','md',20 UNION ALL SELECT 'contact','contact.place','text_image','نشانی و ساعت پاسخ‌گویی','sunken','md',30 UNION ALL SELECT 'contact','contact.body','rich_text','توضیحات تماس','plain','md',40 UNION ALL SELECT 'contact','contact.shortcuts','cards','میان‌برهای راهنما','raised','md',50 UNION ALL SELECT 'contact','contact.closing','cta','پیگیری سفارش','plain','md',60 UNION ALL
  SELECT 'faq','faq.hero','hero','هدر پرسش‌های متداول','plain','none',10 UNION ALL SELECT 'faq','faq.questions','rich_text','پرسش‌ها و پاسخ‌ها','plain','md',20 UNION ALL SELECT 'faq','faq.related','cards','راهنماهای مرتبط','raised','md',30 UNION ALL SELECT 'faq','faq.closing','cta','دعوت پایانی','plain','md',40
) seed ON seed.slug=p.slug
WHERE NOT EXISTS (SELECT 1 FROM `page_sections` s WHERE s.page_id=p.id AND JSON_UNQUOTE(JSON_EXTRACT(s.config,'$.slot'))=seed.slot);
--> statement-breakpoint

INSERT INTO `page_sections` (`page_id`,`kind`,`name`,`config`,`background`,`spacing`,`is_visible`,`sort_order`)
SELECT p.id, seed.kind, seed.name, JSON_OBJECT('slot', seed.slot, 'locked', TRUE), 'plain', 'none', TRUE, seed.sort_order
FROM `pages` p
JOIN (
  SELECT 'generic.header' slot,'hero' kind,'عنوان و تصویر صفحه' name,10 sort_order UNION ALL
  SELECT 'generic.body','rich_text','محتوای اصلی صفحه',20
) seed
WHERE p.slug NOT IN ('about','contact','faq')
AND NOT EXISTS (SELECT 1 FROM `page_sections` s WHERE s.page_id=p.id AND JSON_UNQUOTE(JSON_EXTRACT(s.config,'$.slot'))=seed.slot);
