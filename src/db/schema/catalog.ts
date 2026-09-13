import {
  bigint,
  boolean,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const categories = mysqlTable(
  'categories',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    parentId: bigint('parent_id', { mode: 'number', unsigned: true }),

    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 190 }).notNull(),
    description: text('description'),
    imagePath: varchar('image_path', { length: 255 }),

    sortOrder: int('sort_order').notNull().default(0),
    isVisible: boolean('is_visible').notNull().default(true),

    seoTitle: varchar('seo_title', { length: 190 }),
    seoDescription: varchar('seo_description', { length: 320 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('categories_slug_unq').on(t.slug),
    index('categories_parent_idx').on(t.parentId),
    index('categories_visible_sort_idx').on(t.isVisible, t.sortOrder),
  ],
)

export const products = mysqlTable(
  'products',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    name: varchar('name', { length: 190 }).notNull(),
    slug: varchar('slug', { length: 190 }).notNull(),
    shortDescription: varchar('short_description', { length: 320 }),
    description: text('description'),

    primaryCategoryId: bigint('primary_category_id', { mode: 'number', unsigned: true }),

    searchText: text('search_text'),

    isActive: boolean('is_active').notNull().default(true),
    isArchived: boolean('is_archived').notNull().default(false),

    isFeatured: boolean('is_featured').notNull().default(false),
    isNewArrival: boolean('is_new_arrival').notNull().default(false),
    isBestseller: boolean('is_bestseller').notNull().default(false),

    ratingSum: int('rating_sum').notNull().default(0),
    ratingCount: int('rating_count').notNull().default(0),

    viewCount: int('view_count').notNull().default(0),
    salesCount: int('sales_count').notNull().default(0),

    seoTitle: varchar('seo_title', { length: 190 }),
    seoDescription: varchar('seo_description', { length: 320 }),

    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('products_slug_unq').on(t.slug),
    index('products_category_active_idx').on(t.primaryCategoryId, t.isActive, t.createdAt),
    index('products_active_created_idx').on(t.isActive, t.createdAt),
    index('products_featured_idx').on(t.isFeatured, t.isActive),
    index('products_bestseller_idx').on(t.isBestseller, t.isActive),
    index('products_new_idx').on(t.isNewArrival, t.isActive),
  ],
)

export const productCategories = mysqlTable(
  'product_categories',
  {
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: bigint('category_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('product_category_unq').on(t.productId, t.categoryId),
    index('product_category_cat_idx').on(t.categoryId),
  ],
)

export const optionDefinitions = mysqlTable(
  'option_definitions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    name: varchar('name', { length: 60 }).notNull(),
    kind: mysqlEnum('kind', ['size', 'color', 'other']).notNull().default('other'),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex('option_definitions_name_kind_unq').on(t.name, t.kind)],
)

export const optionDefinitionValues = mysqlTable(
  'option_definition_values',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    definitionId: bigint('definition_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => optionDefinitions.id, { onDelete: 'cascade' }),
    value: varchar('value', { length: 80 }).notNull(),
    swatchHex: varchar('swatch_hex', { length: 7 }),
    sortOrder: int('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('option_definition_value_unq').on(t.definitionId, t.value)],
)

export const productOptions = mysqlTable(
  'product_options',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    definitionId: bigint('definition_id', { mode: 'number', unsigned: true })
      .references(() => optionDefinitions.id, { onDelete: 'restrict' }),

    name: varchar('name', { length: 60 }).notNull(),
    kind: mysqlEnum('kind', ['size', 'color', 'other']).notNull().default('other'),
    note: varchar('note', { length: 500 }),
    sortOrder: int('sort_order').notNull().default(0),
  },
  (t) => [
    index('product_options_product_idx').on(t.productId),
    index('product_options_definition_idx').on(t.productId, t.definitionId),
  ],
)

export const productOptionValues = mysqlTable(
  'product_option_values',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    optionId: bigint('option_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => productOptions.id, { onDelete: 'cascade' }),
    definitionValueId: bigint('definition_value_id', { mode: 'number', unsigned: true })
      .references(() => optionDefinitionValues.id, { onDelete: 'restrict' }),

    value: varchar('value', { length: 80 }).notNull(),
    swatchHex: varchar('swatch_hex', { length: 7 }),
    sortOrder: int('sort_order').notNull().default(0),
  },
  (t) => [
    index('option_values_option_idx').on(t.optionId),
    uniqueIndex('option_value_unq').on(t.optionId, t.value),
  ],
)

export const productVariants = mysqlTable(
  'product_variants',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),

    sku: varchar('sku', { length: 64 }).notNull(),

    price: bigint('price', { mode: 'number', unsigned: true }).notNull(),
    discountPrice: bigint('discount_price', { mode: 'number', unsigned: true }),

    stockQty: int('stock_qty').notNull().default(0),
    lowStockThreshold: int('low_stock_threshold').notNull().default(3),

    imageId: bigint('image_id', { mode: 'number', unsigned: true }),
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('variants_sku_unq').on(t.sku),
    index('variants_product_idx').on(t.productId),
    index('variants_stock_idx').on(t.stockQty),
    index('variants_active_idx').on(t.isActive),
  ],
)

export const variantOptionValues = mysqlTable(
  'variant_option_values',
  {
    variantId: bigint('variant_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    optionId: bigint('option_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => productOptions.id, { onDelete: 'cascade' }),
    optionValueId: bigint('option_value_id', { mode: 'number', unsigned: true }).notNull(),
  },
  (t) => [
    uniqueIndex('variant_option_unq').on(t.variantId, t.optionId),
    index('variant_option_value_idx').on(t.optionValueId),
    foreignKey({
      name: 'variant_option_values_value_fk',
      columns: [t.optionValueId],
      foreignColumns: [productOptionValues.id],
    }).onDelete('cascade'),
  ],
)

export const productImages = mysqlTable(
  'product_images',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),

    path: varchar('path', { length: 255 }).notNull(),

    alt: varchar('alt', { length: 255 }),

    width: int('width').notNull(),
    height: int('height').notNull(),

    isPrimary: boolean('is_primary').notNull().default(false),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('product_images_product_idx').on(t.productId, t.sortOrder),
    index('product_images_primary_idx').on(t.productId, t.isPrimary),
  ],
)

export const tags = mysqlTable(
  'tags',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
  },
  (t) => [uniqueIndex('tags_slug_unq').on(t.slug)],
)

export const productTags = mysqlTable(
  'product_tags',
  {
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    tagId: bigint('tag_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('product_tag_unq').on(t.productId, t.tagId),
    index('product_tag_tag_idx').on(t.tagId),
  ],
)
