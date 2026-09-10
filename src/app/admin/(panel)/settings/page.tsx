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

  const [
    site,
    contact,
    social,
    shipping,
    seo,
    enamad,
    card,
    torob,
    bitpay,
    getLater,
    providers,
    torobSecretSet,
    torobPasswordSet,
    bitpayKeySet,
  ] = await Promise.all([
      getNamespace('site'),
      getNamespace('contact'),
      getNamespace('social'),
      getNamespace('shipping'),
      getNamespace('seo'),
      getNamespace('enamad'),
      getNamespace('payment_card'),
      getNamespace('torob'),
      getNamespace('bitpay'),
      getNamespace('get_later'),
      providerStatuses(),
      hasSecret('torob', 'clientSecret'),
      hasSecret('torob', 'password'),
      hasSecret('bitpay', 'apiKey'),
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
              namespace="get_later"
              title="خرید با تصمیم بعدی"
              description="متن و مهلت سبدی که مشتری پس از دریافت کالا درباره نگه‌داشتن یا بازگشت اقلام تصمیم می‌گیرد."
              fields={[
                {
                  key: 'title',
                  label: 'عنوان در حساب مشتری',
                  value: getLater.title ?? 'سبد پرداخت بعدی',
                },
                {
                  key: 'description',
                  label: 'راهنمای مشتری',
                  value:
                    getLater.description ??
                    'کالاهایی را که می‌خواهید نگه دارید مشخص کنید؛ مبلغ همان کالاها برای پرداخت آماده می‌شود.',
                  multiline: true,
                },
                {
                  key: 'deadlineDays',
                  label: 'مهلت پیش‌فرض (روز)',
                  value: getLater.deadlineDays ?? '7',
                  dir: 'ltr',
                  hint: 'بین ۱ تا ۳۰ روز. مدیر می‌تواند مهلت هر سبد را جداگانه تغییر دهد.',
                },
                {
                  key: 'submitLabel',
                  label: 'متن دکمه نهایی',
                  value: getLater.submitLabel ?? 'ارسال اکنون',
                },
              ]}
              toggle={{
                key: 'enabled',
                label: 'فعال‌سازی این خدمت برای مشتریان',
                value: getLater.enabled === '1',
              }}
            />

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
              description="هزینه‌ها به تومان هستند و در سبد، تسویه‌حساب و سفارش نهایی به‌صورت یکسان محاسبه می‌شوند."
              fields={[
                {
                  key: 'shippingFee',
                  label: 'هزینه ثابت ارسال (تومان)',
                  value: shipping.shippingFee ?? '0',
                  dir: 'ltr',
                  hint: 'صفر یعنی ارسال رایگان.',
                },
                {
                  key: 'freeShippingThreshold',
                  label: 'حداقل خرید برای ارسال رایگان (تومان)',
                  value: shipping.freeShippingThreshold ?? '0',
                  dir: 'ltr',
                  hint: 'صفر یعنی این شرط غیرفعال است.',
                },
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
                  ? 'اعتبارنامه ذخیره شده است. ترب‌پی فقط برای سفارش‌های واجد شرایط نمایش داده می‌شود.'
                  : 'برای فعال‌سازی، چهار مشخصه دسترسی دریافت‌شده از ترب‌پی را وارد کنید.'
              }
              fields={[
                {
                  key: 'clientId',
                  label: 'شناسه مشتری (Client ID)',
                  value: torob.clientId ?? '',
                  dir: 'ltr',
                },
                {
                  key: 'clientSecret',
                  label: 'کد دسترسی (Client Secret)',
                  value: '',
                  dir: 'ltr',
                  secret: true,
                  isSet: torobSecretSet,
                },
                {
                  key: 'username',
                  label: 'نام کاربری ترب‌پی',
                  value: torob.username ?? '',
                  dir: 'ltr',
                },
                {
                  key: 'password',
                  label: 'رمز عبور ترب‌پی',
                  value: '',
                  dir: 'ltr',
                  secret: true,
                  isSet: torobPasswordSet,
                },
              ]}
              toggle={{ key: 'enabled', label: 'فعال', value: torob.enabled === '1' }}
            />

            <SettingsSection
              namespace="bitpay"
              title="درگاه بیت‌پی"
              description="کلید API را از پنل bitpay.ir دریافت کنید. اطلاعات کارت بانکی مشتری در سایت ذخیره نمی‌شود."
              fields={[
                {
                  key: 'apiKey',
                  label: 'کلید API بیت‌پی',
                  value: '',
                  dir: 'ltr',
                  secret: true,
                  isSet: bitpayKeySet,
                },
              ]}
              toggle={{ key: 'enabled', label: 'فعال', value: bitpay.enabled === '1' }}
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
