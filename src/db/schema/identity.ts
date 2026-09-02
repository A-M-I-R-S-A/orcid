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

/**
 * Customers. Phone number is the identity — there is no password anywhere in
 * this table by design (§23: OTP is the only customer authentication path).
 */
export const users = mysqlTable(
  'users',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    /** Normalised to 11 digits, leading zero, e.g. 09121234567. */
    phone: varchar('phone', { length: 11 }).notNull(),

    fullName: varchar('full_name', { length: 120 }),
    email: varchar('email', { length: 190 }),

    phoneVerifiedAt: timestamp('phone_verified_at'),
    isActive: boolean('is_active').notNull().default(true),

    /** Set by an admin when disabling an account; shown to no one but admins. */
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

/**
 * Customer sessions. Opaque random tokens, stored hashed — a database dump
 * does not hand out live sessions. Server-side revocable, which a JWT is not.
 */
export const sessions = mysqlTable(
  'sessions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** SHA-256 of the token. The plaintext exists only in the cookie. */
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

/**
 * OTP requests.
 *
 * §24: the code is NEVER stored in plaintext, never logged, never returned to
 * the client. `codeHash` is HMAC-SHA256(code, OTP_PEPPER) — a leaked database
 * yields nothing without the environment pepper, and six-digit codes would be
 * trivially rainbow-tabled under a plain hash.
 */
export const otpRequests = mysqlTable(
  'otp_requests',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    phone: varchar('phone', { length: 11 }).notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),

    purpose: mysqlEnum('purpose', ['login', 'verify_phone']).notNull().default('login'),

    attempts: int('attempts').notNull().default(0),
    maxAttempts: int('max_attempts').notNull().default(5),

    /** Single-use: set on successful verification, checked on every attempt. */
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

/**
 * Fixed-window rate limiting in MariaDB, because Redis is assumed unavailable
 * (§84). `identifier` is a scoped key such as "otp:09121234567" or "login:1.2.3.4".
 */
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

/** Saved delivery addresses. Snapshotted onto the order at checkout. */
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
