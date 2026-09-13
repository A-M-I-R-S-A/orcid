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
import { adminUsers } from './admin'

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

export const GATEWAY_ATTEMPT_STATUSES = [
  'creating',
  'pending',
  'review',
  'paid',
  'failed',
] as const

export const GET_LATER_STATUSES = [
  'draft',
  'open',
  'submitted',
  'converted',
  'cancelled',
] as const

export const GET_LATER_DECISIONS = ['undecided', 'pay', 'return'] as const

export const carts = mysqlTable(
  'carts',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    userId: bigint('user_id', { mode: 'number', unsigned: true }).references(() => users.id, {
      onDelete: 'cascade',
    }),

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

export const shippingMethods = mysqlTable(
  'shipping_methods',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    fee: bigint('fee', { mode: 'number', unsigned: true }).notNull().default(0),
    freeThreshold: bigint('free_threshold', { mode: 'number', unsigned: true }).notNull().default(0),
    isEnabled: mysqlEnum('is_enabled', ['0', '1']).notNull().default('1'),
    isDefault: mysqlEnum('is_default', ['0', '1']).notNull().default('0'),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index('shipping_methods_enabled_sort_idx').on(t.isEnabled, t.sortOrder),
    index('shipping_methods_default_idx').on(t.isDefault),
  ],
)

export const orders = mysqlTable(
  'orders',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    orderNumber: varchar('order_number', { length: 32 }).notNull(),

    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    status: mysqlEnum('status', ORDER_STATUSES).notNull().default('awaiting_payment'),
    paymentStatus: mysqlEnum('payment_status', PAYMENT_STATUSES).notNull().default('pending'),
    paymentMethod: varchar('payment_method', { length: 32 }).notNull(),

    subtotal: bigint('subtotal', { mode: 'number', unsigned: true }).notNull(),
    discountTotal: bigint('discount_total', { mode: 'number', unsigned: true })
      .notNull()
      .default(0),
    shippingTotal: bigint('shipping_total', { mode: 'number', unsigned: true })
      .notNull()
      .default(0),
    shippingMethodId: bigint('shipping_method_id', { mode: 'number', unsigned: true }).references(
      () => shippingMethods.id,
      { onDelete: 'set null' },
    ),
    shippingMethodName: varchar('shipping_method_name', { length: 120 }),
    grandTotal: bigint('grand_total', { mode: 'number', unsigned: true }).notNull(),

    shipFullName: varchar('ship_full_name', { length: 120 }).notNull(),
    shipPhone: varchar('ship_phone', { length: 11 }).notNull(),
    shipProvince: varchar('ship_province', { length: 60 }).notNull(),
    shipCity: varchar('ship_city', { length: 80 }).notNull(),
    shipAddressLine: text('ship_address_line').notNull(),
    shipPostalCode: varchar('ship_postal_code', { length: 10 }).notNull(),
    shipmentCompany: varchar('shipment_company', { length: 80 }),
    shipmentTrackingCode: varchar('shipment_tracking_code', { length: 80 }),
    customerNote: text('customer_note'),

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

export const orderItems = mysqlTable(
  'order_items',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    orderId: bigint('order_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),

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

    referenceCode: varchar('reference_code', { length: 191 }),
    referenceSubmittedAt: timestamp('reference_submitted_at'),

    reviewedByAdminId: bigint('reviewed_by_admin_id', { mode: 'number', unsigned: true }),
    reviewedAt: timestamp('reviewed_at'),
    adminNote: text('admin_note'),

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

export const paymentGatewayAttempts = mysqlTable(
  'payment_gateway_attempts',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    paymentId: bigint('payment_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    amountRial: bigint('amount_rial', { mode: 'number', unsigned: true }).notNull(),
    state: varchar('state', { length: 64 }).notNull(),
    token: varchar('token', { length: 1000 }),
    redirectUrl: text('redirect_url'),
    reference: varchar('reference', { length: 191 }),
    status: mysqlEnum('status', GATEWAY_ATTEMPT_STATUSES).notNull().default('creating'),
    lockedUntil: timestamp('locked_until'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('payment_gateway_attempts_payment_unq').on(t.paymentId),
    uniqueIndex('payment_gateway_attempts_state_unq').on(t.state),
    uniqueIndex('payment_gateway_attempts_reference_unq').on(t.provider, t.reference),
    index('payment_gateway_attempts_status_idx').on(t.status, t.updatedAt),
  ],
)

export const getLaterCarts = mysqlTable(
  'get_later_carts',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    activeUserId: bigint('active_user_id', { mode: 'number', unsigned: true }).references(
      () => users.id,
      { onDelete: 'restrict' },
    ),
    createdByAdminId: bigint('created_by_admin_id', { mode: 'number', unsigned: true })
      .references(() => adminUsers.id, { onDelete: 'restrict' }),
    orderId: bigint('order_id', { mode: 'number', unsigned: true }).references(() => orders.id, {
      onDelete: 'restrict',
    }),
    status: mysqlEnum('status', GET_LATER_STATUSES).notNull().default('draft'),
    adminNote: text('admin_note'),
    customerNote: text('customer_note'),
    expiresAt: timestamp('expires_at'),
    openedAt: timestamp('opened_at'),
    submittedAt: timestamp('submitted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    index('get_later_user_status_idx').on(t.userId, t.status),
    index('get_later_status_created_idx').on(t.status, t.createdAt),
    uniqueIndex('get_later_order_unq').on(t.orderId),
    uniqueIndex('get_later_active_user_unq').on(t.activeUserId),
  ],
)

export const getLaterItems = mysqlTable(
  'get_later_items',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    cartId: bigint('cart_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => getLaterCarts.id, { onDelete: 'cascade' }),
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
    originalPrice: bigint('original_price', { mode: 'number', unsigned: true }).notNull(),
    unitPrice: bigint('unit_price', { mode: 'number', unsigned: true }).notNull(),
    quantity: int('quantity').notNull(),
    decision: mysqlEnum('decision', GET_LATER_DECISIONS).notNull().default('undecided'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('get_later_item_unq').on(t.cartId, t.variantId),
    index('get_later_items_cart_idx').on(t.cartId),
  ],
)

export const wishlistItems = mysqlTable(
  'wishlist_items',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('wishlist_user_product_unq').on(t.userId, t.productId),
    index('wishlist_user_created_idx').on(t.userId, t.createdAt),
  ],
)
