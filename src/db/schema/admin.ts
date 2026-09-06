import {
  bigint,
  boolean,
  datetime,
  index,
  json,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const adminUsers = mysqlTable(
  'admin_users',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    username: varchar('username', { length: 60 }).notNull(),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    email: varchar('email', { length: 190 }),

    passwordHash: varchar('password_hash', { length: 255 }).notNull(),

    roleId: bigint('role_id', { mode: 'number', unsigned: true }).notNull(),
    isActive: boolean('is_active').notNull().default(true),

    lastLoginAt: timestamp('last_login_at'),
    failedAttempts: bigint('failed_attempts', { mode: 'number' }).notNull().default(0),
    lockedUntil: datetime('locked_until'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('admin_username_unq').on(t.username),
    index('admin_role_idx').on(t.roleId),
  ],
)

export const roles = mysqlTable(
  'roles',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    key: varchar('key', { length: 60 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 255 }),

    isSystem: boolean('is_system').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex('roles_key_unq').on(t.key)],
)

export const permissions = mysqlTable(
  'permissions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    key: varchar('key', { length: 80 }).notNull(),
    groupKey: varchar('group_key', { length: 40 }).notNull(),
    label: varchar('label', { length: 160 }).notNull(),
  },
  (t) => [
    uniqueIndex('permissions_key_unq').on(t.key),
    index('permissions_group_idx').on(t.groupKey),
  ],
)

export const rolePermissions = mysqlTable(
  'role_permissions',
  {
    roleId: bigint('role_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: bigint('permission_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('role_perm_unq').on(t.roleId, t.permissionId),
    index('role_perm_role_idx').on(t.roleId),
  ],
)

export const adminSessions = mysqlTable(
  'admin_sessions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    adminUserId: bigint('admin_user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 255 }),
    expiresAt: datetime('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('admin_sessions_token_unq').on(t.tokenHash),
    index('admin_sessions_user_idx').on(t.adminUserId),
  ],
)

export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),

    actorId: bigint('actor_id', { mode: 'number', unsigned: true }),
    actorName: varchar('actor_name', { length: 120 }).notNull(),

    action: varchar('action', { length: 80 }).notNull(),
    entityType: varchar('entity_type', { length: 60 }).notNull(),
    entityId: varchar('entity_id', { length: 60 }),
    summary: varchar('summary', { length: 255 }),

    metadata: json('metadata'),
    ip: varchar('ip', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_created_idx').on(t.createdAt),
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_actor_idx').on(t.actorId),
    index('audit_action_idx').on(t.action),
  ],
)
