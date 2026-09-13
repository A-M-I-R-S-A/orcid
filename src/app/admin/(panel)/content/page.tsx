import { PageHeader } from '@/components/admin/ui'
import { SiteContentEditor } from '@/components/admin/site-content-editor'
import { requirePermission } from '@/modules/admin/auth'
import { getSiteContent, COPY_CATALOG } from '@/lib/site-content'

export const dynamic = 'force-dynamic'
export default async function ContentPage() { await requirePermission('appearance.brand'); const content = await getSiteContent(); return <><PageHeader title="متن و ظاهر سایت" description="تمام متن‌های عمومی و حالت نمایش آن‌ها را از اینجا تغییر دهید." /><SiteContentEditor catalog={COPY_CATALOG} initialCopy={content.rawCopy} initialStyles={content.rawStyles} /></> }
