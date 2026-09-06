import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const users = mysqlTable(
  'users',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    phone: varchar('phone', { length: 11 }).notNull(),

    fullName: varchar('full_name', { length: 120 }),
    email: varchar('email', { length: 190 }),

    passwordHash: varchar('password_hash', { length: 255 }),
    passwordSetAt: timestamp('password_set_at'),

    phoneVerifiedAt: timestamp('phone_verified_at'),
    isActive: boolean('is_active').notNull().default(true),

    disabledReason: varchar('disabled_reason', { length: 255 }),

    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('users_phone_unq').on(t.phone),
    index('users_created_idx').on(t.createdAt),
    index('users_active_idx').on(t.isActive),
  ],
)

export const sessions = mysqlTable(
  'sessions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    tokenHash: varchar('token_hash', { length: 64 }).notNull(),

    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 255 }),

    expiresAt: datetime('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_unq').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
)

export const otpRequests = mysqlTable(
  'otp_requests',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    phone: varchar('phone', { length: 11 }).notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),

    purpose: mysqlEnum('purpose', [
      'login',
      'verify_phone',
      'register',
      'password_reset',
    ])
      .notNull()
      .default('login'),

    attempts: int('attempts').notNull().default(0),
    maxAttempts: int('max_attempts').notNull().default(5),

    consumedAt: timestamp('consumed_at'),
    expiresAt: datetime('expires_at').notNull(),

    ip: varchar('ip', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('otp_phone_created_idx').on(t.phone, t.createdAt),
    index('otp_expires_idx').on(t.expiresAt),
  ],
)

export const rateLimits = mysqlTable(
  'rate_limits',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    identifier: varchar('identifier', { length: 190 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    count: int('count').notNull().default(0),
    windowStart: datetime('window_start').notNull(),
    expiresAt: datetime('expires_at').notNull(),
  },
  (t) => [
    uniqueIndex('rl_identifier_action_unq').on(t.identifier, t.action),
    index('rl_expires_idx').on(t.expiresAt),
  ],
)

export const addresses = mysqlTable(
  'addresses',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    fullName: varchar('full_name', { length: 120 }).notNull(),
    phone: varchar('phone', { length: 11 }).notNull(),
    province: varchar('province', { length: 60 }).notNull(),
    city: varchar('city', { length: 80 }).notNull(),
    addressLine: text('address_line').notNull(),
    postalCode: varchar('postal_code', { length: 10 }).notNull(),
    notes: text('notes'),

    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
)
