# TorobPay and BitPay

Both online gateways are disabled by default. Their credentials are managed in
**Admin → Settings** and secrets are encrypted with `ENCRYPTION_KEY`.

## Deployment

1. Back up the database and uploads.
2. Run `npm run db:migrate` to create `payment_gateway_attempts` from
   `drizzle/0005_payment_gateways.sql`.
3. Keep `ENCRYPTION_KEY` stable and backed up separately from the database.
4. Set `APP_URL` to the public HTTPS origin, then build and restart the app.
5. Enter all four TorobPay credentials and/or the BitPay API key in the admin
   panel. Blank secret fields preserve the previously saved value.
6. Enable one gateway at a time and perform a merchant-approved low-value test.

Public callbacks accept GET and URL-encoded POST and do not depend on a browser
session:

- `/api/payments/torob_pay/callback`
- `/api/payments/bitpay/callback`

The callback query string contains an opaque one-time state. A reverse proxy or
WAF must allow that query string and must not place an authentication challenge
in front of these routes.

## Safety model

- Checkout totals are recalculated by the server. Gateway requests use rial;
  catalog and order amounts remain in toman.
- TorobPay is displayed only when its eligibility service accepts the current
  order amount. Eligibility is checked again before the order is created and
  before a payment token is requested.
- One persistent gateway attempt is allowed per order. A successful repeated
  click reuses its redirect URL. An uncertain creation failure is held for
  review instead of automatically creating a second charge.
- Callback parameters identify a payment but never prove it. BitPay is verified
  server-to-server against the stored gateway ID, exact amount, and factor ID.
- TorobPay is verified and settled server-to-server before an order becomes
  paid. Returned redirect URLs are restricted to HTTPS TorobPay hosts.
- Verification uses a database lease and idempotent state transitions so replayed
  or concurrent callbacks cannot approve a payment twice.
- Online payments cannot be manually approved, rejected, or cancelled through
  the generic admin controls. Reconcile refunds and uncertain transactions in
  the provider panel before changing fulfillment state.
- Customers and authorized admins can recheck an interrupted payment from the
  order detail page. Disabling a gateway blocks new attempts but does not block
  verification of an existing one.

## Acceptance checklist

Before opening sales, test successful payment, cancellation at the bank, an
interrupted return, a repeated callback, wrong amount/factor rejection, and
manual status recheck. Confirm exactly one order is marked paid and exactly one
payment-confirmation SMS is queued. Real provider certification requires the
merchant accounts and cannot be proven by offline tests.

Protocol references used by the implementation:

- BitPay's `gateway-send`, hosted gateway, and `gateway-result-second` flow.
- TorobPay's online-merchant OAuth, eligibility, token, status, verify, and
  settle flow as implemented in the supplied `../yarno` and `../Termme-final`
  integrations.
