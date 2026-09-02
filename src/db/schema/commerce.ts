import {
  bigint,
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

import { productVariants, products } from './catalog'
import { users } from './identity'

/**
 * Internal state identifiers are stable English enums; the Persian labels the
 * customer sees live in lib/order-status.ts. §34 — renaming a label must never
 * require a data migration.
 */
export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'payment_verification',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'rejected',
] as const

export const PAYMENT_STATUSES = [
  'pending',
  'reference_submitted',
  'approved',
  'rejected',
  'refunded',
] as const

/**
 * Carts. A cart item stores ONLY a variant and a quantity — never a price.
 * Every total is recomputed server-side from live variant rows at render and
 * again inside the checkout transaction. §21: never trust the client.
 */
export const carts = mysqlTable(
  'carts',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    /** Null for guests; adopted on login by merging into the user's cart. */
    userId: bigint('user_id', { mode: 'number', unsigned: true }).references(() => users.id, {
      onDelete: 'cascade',
    }),

    /** Opaque cookie token for anonymous carts. */
    token: varchar('token', { length: 64 }).notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('carts_token_unq').on(t.token),
    index('carts_user_idx').on(t.userId),
    index('carts_updated_idx').on(t.updatedAt),
  ],
)

export const cartItems = mysqlTable(
  'cart_items',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    cartId: bigint('cart_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: bigint('variant_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: int('quantity').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cart_item_unq').on(t.cartId, t.variantId),
    index('cart_items_cart_idx').on(t.cartId),
  ],
)

export const orders = mysqlTable(
  'orders',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    /** Human-facing, e.g. ORC-1403-000042. Shown to the customer and in SMS. */
    orderNumber: varchar('order_number', { length: 32 }).notNull(),

    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    status: mysqlEnum('status', ORDER_STATUSES).notNull().default('awaiting_payment'),
    paymentStatus: mysqlEnum('payment_status', PAYMENT_STATUSES).notNull().default('pending'),
    paymentMethod: varchar('payment_method', { length: 32 }).notNull(),

    // All amounts Toman, integer. Computed server-side, stored for the record.
    subtotal: bigint('subtotal', { mode: 'number', unsigned: true }).notNull(),
    discountTotal: bigint('discount_total', { mode: 'number', unsigned: true })
      .notNull()
      .default(0),
    shippingTotal: bigint('shipping_total', { mode: 'number', unsigned: true })
      .notNull()
      .default(0),
    grandTotal: bigint('grand_total', { mode: 'number', unsigned: true }).notNull(),

    // Address is SNAPSHOTTED, not joined. Editing a saved address later must
    // not silently rewrite where a past order was shipped.
    shipFullName: varchar('ship_full_name', { length: 120 }).notNull(),
    shipPhone: varchar('ship_phone', { length: 11 }).notNull(),
    shipProvince: varchar('ship_province', { length: 60 }).notNull(),
    shipCity: varchar('ship_city', { length: 80 }).notNull(),
    shipAddressLine: text('ship_address_line').notNull(),
    shipPostalCode: varchar('ship_postal_code', { length: 10 }).notNull(),
    customerNote: text('customer_note'),

    /** Admin-only. Never rendered in the customer account area. §36. */
    internalNote: text('internal_note'),

    paidAt: timestamp('paid_at'),
    shippedAt: timestamp('shipped_at'),
    deliveredAt: timestamp('delivered_at'),
    cancelledAt: timestamp('cancelled_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('orders_number_unq').on(t.orderNumber),
    index('orders_user_created_idx').on(t.userId, t.createdAt),
    index('orders_status_created_idx').on(t.status, t.createdAt),
    index('orders_payment_status_idx').on(t.paymentStatus, t.createdAt),
  ],
)

/**
 * Immutable snapshot of what was bought. Product name, variant label and unit
 * price are COPIED at checkout — a later price change or rename cannot rewrite
 * history, and an order stays readable after the product is archived.
 */
export const orderItems = mysqlTable(
  'order_items',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    orderId: bigint('order_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

    // RESTRICT: an ordered variant can be archived but never deleted.
    variantId: bigint('variant_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),

    productName: varchar('product_name', { length: 190 }).notNull(),
    productSlug: varchar('product_slug', { length: 190 }).notNull(),
    variantLabel: varchar('variant_label', { length: 190 }),
    sku: varchar('sku', { length: 64 }).notNull(),
    imagePath: varchar('image_path', { length: 255 }),

    unitPrice: bigint('unit_price', { mode: 'number', unsigned: true }).notNull(),
    quantity: int('quantity').notNull(),
    lineTotal: bigint('line_total', { mode: 'number', unsigned: true }).notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    index('order_items_product_idx').on(t.productId),
  ],
)

/**
 * Payments. For card-to-card the reference code is customer-supplied and
 * cannot be verified programmatically — the unique index catches reuse, and an
 * administrator confirms it against a bank statement. §G.
 */
export const payments = mysqlTable(
  'payments',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    orderId: bigint('order_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    method: varchar('method', { length: 32 }).notNull(),
    status: mysqlEnum('status', PAYMENT_STATUSES).notNull().default('pending'),
    amount: bigint('amount', { mode: 'number', unsigned: true }).notNull(),

    /** کد رهگیری / شماره پیگیری. Unique — a code cannot be reused. §30. */
    referenceCode: varchar('reference_code', { length: 64 }),
    referenceSubmittedAt: timestamp('reference_submitted_at'),

    /** Which admin decided, and when. Never nullable once status is terminal. */
    reviewedByAdminId: bigint('reviewed_by_admin_id', { mode: 'number', unsigned: true }),
    reviewedAt: timestamp('reviewed_at'),
    adminNote: text('admin_note'),

    /** Gateway payloads for future providers. Scrubbed of credentials. */
    providerData: json('provider_data'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('payments_reference_unq').on(t.referenceCode),
    index('payments_order_idx').on(t.orderId),
    index('payments_status_created_idx').on(t.status, t.createdAt),
    index('payments_user_idx').on(t.userId),
  ],
)
