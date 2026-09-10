import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

import { products } from './catalog'
import { adminUsers } from './admin'
import { users } from './identity'

export const reviews = mysqlTable(
  'reviews',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    rating: int('rating').notNull(),
    title: varchar('title', { length: 160 }),
    body: text('body').notNull(),

    status: mysqlEnum('status', ['pending', 'approved', 'rejected', 'hidden'])
      .notNull()
      .default('pending'),

    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),

    moderatedByAdminId: bigint('moderated_by_admin_id', { mode: 'number', unsigned: true }),
    moderatedAt: timestamp('moderated_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('review_user_product_unq').on(t.userId, t.productId),
    index('reviews_product_status_idx').on(t.productId, t.status),
    index('reviews_status_created_idx').on(t.status, t.createdAt),
  ],
)

export const reviewReplies = mysqlTable(
  'review_replies',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    reviewId: bigint('review_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    adminUserId: bigint('admin_user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'restrict' }),

    body: text('body').notNull(),
    isVisible: boolean('is_visible').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex('review_reply_unq').on(t.reviewId)],
)

export const SMS_EVENTS = [
  'otp_login',
  'order_created',
  'payment_approved',
  'order_shipped',
] as const

export const smsTemplates = mysqlTable(
  'sms_templates',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    event: mysqlEnum('event', SMS_EVENTS).notNull(),
    name: varchar('name', { length: 120 }).notNull(),

    providerTemplateId: varchar('provider_template_id', { length: 40 }),

    parameters: json('parameters'),

    isEnabled: boolean('is_enabled').notNull().default(false),

    requiresApproval: boolean('requires_approval').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex('sms_templates_event_unq').on(t.event)],
)

export const smsMessages = mysqlTable(
  'sms_messages',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    event: mysqlEnum('event', SMS_EVENTS).notNull(),
    phone: varchar('phone', { length: 11 }).notNull(),

    payload: json('payload'),

    status: mysqlEnum('status', ['pending', 'approved', 'sending', 'sent', 'failed', 'cancelled'])
      .notNull()
      .default('pending'),

    orderId: bigint('order_id', { mode: 'number', unsigned: true }),

    approvedByAdminId: bigint('approved_by_admin_id', { mode: 'number', unsigned: true }),
    approvedAt: timestamp('approved_at'),

    attempts: int('attempts').notNull().default(0),
    maxAttempts: int('max_attempts').notNull().default(3),

    providerMessageId: varchar('provider_message_id', { length: 80 }),
    lastError: varchar('last_error', { length: 255 }),

    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index('sms_status_created_idx').on(t.status, t.createdAt),
    index('sms_order_idx').on(t.orderId),
    index('sms_event_idx').on(t.event),
  ],
)

export const pages = mysqlTable(
  'pages',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    slug: varchar('slug', { length: 190 }).notNull(),
    title: varchar('title', { length: 190 }).notNull(),

    body: text('body'),

    imagePath: varchar('image_path', { length: 255 }),

    isPublished: boolean('is_published').notNull().default(true),
    showInFooter: boolean('show_in_footer').notNull().default(false),
    sortOrder: int('sort_order').notNull().default(0),

    seoTitle: varchar('seo_title', { length: 190 }),
    seoDescription: varchar('seo_description', { length: 320 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex('pages_slug_unq').on(t.slug)],
)

export const homepageSections = mysqlTable(
  'homepage_sections',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    kind: mysqlEnum('kind', [
      'hero',
      'featured_products',
      'categories',
      'new_arrivals',
      'bestsellers',
      'promo_banner',
      'brand_story',
      'reviews',
      'blog_teaser',
      'newsletter',
    ]).notNull(),

    title: varchar('title', { length: 190 }),
    subtitle: varchar('subtitle', { length: 320 }),
    imagePath: varchar('image_path', { length: 255 }),
    linkUrl: varchar('link_url', { length: 255 }),
    linkLabel: varchar('link_label', { length: 80 }),

    config: json('config'),

    isVisible: boolean('is_visible').notNull().default(true),
    sortOrder: int('sort_order').notNull().default(0),

    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index('homepage_sections_order_idx').on(t.isVisible, t.sortOrder)],
)

export const blogCategories = mysqlTable(
  'blog_categories',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 190 }).notNull(),
    description: varchar('description', { length: 320 }),
  },
  (t) => [uniqueIndex('blog_categories_slug_unq').on(t.slug)],
)

export const blogPosts = mysqlTable(
  'blog_posts',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    title: varchar('title', { length: 190 }).notNull(),
    slug: varchar('slug', { length: 190 }).notNull(),
    excerpt: varchar('excerpt', { length: 320 }),
    body: text('body'),

    categoryId: bigint('category_id', { mode: 'number', unsigned: true }).references(
      () => blogCategories.id,
      { onDelete: 'set null' },
    ),
    authorAdminId: bigint('author_admin_id', { mode: 'number', unsigned: true }),

    coverImagePath: varchar('cover_image_path', { length: 255 }),
    coverImageAlt: varchar('cover_image_alt', { length: 255 }),

    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at'),

    seoTitle: varchar('seo_title', { length: 190 }),
    seoDescription: varchar('seo_description', { length: 320 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('blog_posts_slug_unq').on(t.slug),
    index('blog_published_idx').on(t.isPublished, t.publishedAt),
    index('blog_category_idx').on(t.categoryId),
  ],
)

export const settings = mysqlTable(
  'settings',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    namespace: varchar('namespace', { length: 40 }).notNull(),
    key: varchar('key', { length: 80 }).notNull(),
    value: text('value'),
    isSecret: boolean('is_secret').notNull().default(false),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('settings_ns_key_unq').on(t.namespace, t.key),
    index('settings_ns_idx').on(t.namespace),
  ],
)

export const settingsVersion = mysqlTable('settings_version', {
  id: int('id').primaryKey(),
  version: bigint('version', { mode: 'number', unsigned: true }).notNull().default(1),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
})

export const slugRedirects = mysqlTable(
  'slug_redirects',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    entityType: mysqlEnum('entity_type', ['product', 'category', 'blog_post', 'page']).notNull(),
    oldSlug: varchar('old_slug', { length: 190 }).notNull(),
    newSlug: varchar('new_slug', { length: 190 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('slug_redirect_unq').on(t.entityType, t.oldSlug)],
)

export const NAV_PLACEMENTS = ['header', 'footer_shop', 'footer_help'] as const

export type NavPlacement = (typeof NAV_PLACEMENTS)[number]

export const navLinks = mysqlTable(
  'nav_links',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    placement: mysqlEnum('placement', NAV_PLACEMENTS).notNull(),
    label: varchar('label', { length: 60 }).notNull(),
    href: varchar('href', { length: 255 }).notNull(),
    isVisible: boolean('is_visible').notNull().default(true),
    sortOrder: int('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index('nav_links_placement_idx').on(t.placement, t.isVisible, t.sortOrder)],
)
