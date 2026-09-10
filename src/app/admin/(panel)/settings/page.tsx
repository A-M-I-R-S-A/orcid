import { PageHeader } from '@/components/admin/ui'
import { SettingsSection } from '@/components/admin/settings-form'
import { requirePermission } from '@/modules/admin/auth'
import { getCurrentAdmin } from '@/lib/session'
import { providerStatuses } from '@/modules/payments/registry'
import { hasPermission } from '@/lib/permissions'
import { getNamespace, hasSecret } from '@/lib/settings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تنظیمات' }

export default async function SettingsPage() {
  await requirePermission('settings.view')
  const admin = await getCurrentAdmin()
  if (!admin) return null

  const [site, contact, social, shipping, seo, enamad, card, torob, providers, torobKeySet, torobCodeSet] =
    await Promise.all([
      getNamespace('site'),
      getNamespace('contact'),
      getNamespace('social'),
      getNamespace('shipping'),
      getNamespace('seo'),
      getNamespace('enamad'),
      getNamespace('payment_card'),
      getNamespace('torob'),
      providerStatuses(),
      hasSecret('torob', 'apiKey'),
      hasSecret('torob', 'accessCode'),
    ])

  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(admin, p)

  const torobStatus = providers.find((p) => p.key === 'torob_pay')

  return (
    <>
      <PageHeader title="تنظیمات" description="پیکربندی عمومی فروشگاه" />

      <div className="space-y-6">
        {can('appearance.brand') && (
          <SettingsSection
            namespace="site"
            title="هویت فروشگاه"
            description="نام، شعار و متن‌های عمومی سایت"
            fields={[
              { key: 'siteName', label: 'نام فروشگاه', value: site.siteName ?? 'ارکید' },
              { key: 'tagline', label: 'شعار (زیر لوگو در فوتر)', value: site.tagline ?? '' },
              {
                key: 'announcementText',
                label: 'نوار اعلان بالای سایت',
                value: site.announcementText ?? '',
                hint: 'خالی بگذارید تا نمایش داده نشود.',
              },
              {
                key: 'announcementHref',
                label: 'پیوند نوار اعلان',
                value: site.announcementHref ?? '',
                dir: 'ltr',
                hint: 'اختیاری. با / شروع شود یا نشانی کامل https باشد.',
              },
              {
                key: 'announcementEnabled',
                label: 'نمایش نوار اعلان',
                value: site.announcementEnabled ?? '1',
                hint: 'برای پنهان کردن موقت بدون پاک کردن متن، مقدار را 0 بگذارید.',
                dir: 'ltr',
              },
              { key: 'footerNote', label: 'یادداشت فوتر', value: site.footerNote ?? '' },
              {
                key: 'footerShopHeading',
                label: 'عنوان ستون اول فوتر',
                value: site.footerShopHeading ?? '',
                hint: 'خالی بگذارید تا «فروشگاه» استفاده شود.',
              },
              {
                key: 'footerHelpHeading',
                label: 'عنوان ستون دوم فوتر',
                value: site.footerHelpHeading ?? '',
                hint: 'خالی بگذارید تا «راهنما و پشتیبانی» استفاده شود.',
              },
              {
                key: 'footerContactHeading',
                label: 'عنوان ستون تماس فوتر',
                value: site.footerContactHeading ?? '',
                hint: 'خالی بگذارید تا «تماس با ما» استفاده شود.',
              },
            ]}
          />
        )}

        {can('settings.manage') && (
          <>
            <SettingsSection
              namespace="contact"
              title="اطلاعات تماس"
              fields={[
                { key: 'phone', label: 'شماره تماس', value: contact.phone ?? '', dir: 'ltr' },
                { key: 'email', label: 'ایمیل', value: contact.email ?? '', dir: 'ltr' },
                { key: 'address', label: 'نشانی', value: contact.address ?? '', multiline: true },
                { key: 'workingHours', label: 'ساعات پاسخگویی', value: contact.workingHours ?? '' },
              ]}
            />

            <SettingsSection
              namespace="social"
              title="شبکه‌های اجتماعی"
              description="نشانی کامل با https. خالی بگذارید تا نمایش داده نشود."
              fields={[
                { key: 'instagram', label: 'اینستاگرام', value: social.instagram ?? '', dir: 'ltr' },
                { key: 'telegram', label: 'تلگرام', value: social.telegram ?? '', dir: 'ltr' },
                { key: 'whatsapp', label: 'واتس‌اپ', value: social.whatsapp ?? '', dir: 'ltr' },
              ]}
            />

            <SettingsSection
              namespace="shipping"
              title="ارسال و بازگشت کالا"
              fields={[
                {
                  key: 'shippingInfo',
                  label: 'توضیحات ارسال',
                  value: shipping.shippingInfo ?? '',
                  multiline: true,
                },
                {
                  key: 'returnPolicy',
                  label: 'شرایط بازگشت',
                  value: shipping.returnPolicy ?? '',
                  multiline: true,
                },
              ]}
            />
          </>
        )}

        {can('seo.manage') && (
          <SettingsSection
            namespace="seo"
            title="سئو"
            description="مقادیر پیش‌فرض برای صفحاتی که عنوان یا توضیحات اختصاصی ندارند."
            fields={[
              { key: 'defaultTitle', label: 'عنوان پیش‌فرض', value: seo.defaultTitle ?? '' },
              {
                key: 'defaultDescription',
                label: 'توضیحات پیش‌فرض',
                value: seo.defaultDescription ?? '',
                multiline: true,
                hint: 'حداکثر ۱۶۰ کاراکتر توصیه می‌شود.',
              },
              {
                key: 'titleSeparator',
                label: 'جداکننده عنوان',
                value: seo.titleSeparator ?? ' | ',
                dir: 'ltr',
              },
            ]}
          />
        )}

        {can('settings.payment') && (
          <>
            <SettingsSection
              namespace="payment_card"
              title="پرداخت کارت به کارت"
              description="این اطلاعات در صفحه پرداخت به مشتری نمایش داده می‌شود."
              fields={[
                { key: 'bankName', label: 'نام بانک', value: card.bankName ?? '' },
                {
                  key: 'cardNumber',
                  label: 'شماره کارت',
                  value: card.cardNumber ?? '',
                  dir: 'ltr',
                  hint: '۱۶ رقم، بدون فاصله',
                },
                { key: 'accountHolder', label: 'به نام', value: card.accountHolder ?? '' },
                {
                  key: 'instructions',
                  label: 'راهنمای پرداخت',
                  value: card.instructions ?? '',
                  multiline: true,
                },
              ]}
              toggle={{ key: 'enabled', label: 'فعال', value: card.enabled !== '0' }}
            />

            <SettingsSection
              namespace="torob"
              title="ترب‌پی"
              description={
                torobStatus?.configured
                  ? 'اعتبارنامه ذخیره شده است.'
                  : 'برای فعال‌سازی، اعتبارنامه‌ها را وارد کنید. تا پیش از تکمیل پیاده‌سازی درگاه، این روش در تسویه حساب نمایش داده نمی‌شود.'
              }
              fields={[
                {
                  key: 'apiKey',
                  label: 'API Key',
                  value: '',
                  dir: 'ltr',
                  secret: true,
                  isSet: torobKeySet,
                },
                {
                  key: 'accessCode',
                  label: 'Access Code',
                  value: '',
                  dir: 'ltr',
                  secret: true,
                  isSet: torobCodeSet,
                },
              ]}
              toggle={{ key: 'enabled', label: 'فعال', value: torob.enabled === '1' }}
            />
          </>
        )}

        {can('settings.enamad') && (
          <SettingsSection
            namespace="enamad"
            title="ای‌نماد"
            description="کد نماد اعتماد الکترونیکی. کد را از پنل ای‌نماد کپی کرده و اینجا قرار دهید."
            fields={[
              {
                key: 'embedCode',
                label: 'کد نمایش نماد',
                value: enamad.embedCode ?? '',
                multiline: true,
                dir: 'ltr',
                hint: 'این کد در فوتر سایت نمایش داده می‌شود.',
              },
              {
                key: 'metaTag',
                label: 'کد تأیید (meta)',
                value: enamad.metaTag ?? '',
                dir: 'ltr',
                hint: 'در صورت نیاز به تأیید مالکیت دامنه.',
              },
            ]}
          />
        )}
      </div>
    </>
  )
}
