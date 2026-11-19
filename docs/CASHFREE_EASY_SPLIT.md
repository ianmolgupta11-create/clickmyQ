# Cashfree Easy Split Sandbox setup

Cashfree Easy Split is used for online appointment booking fees. The platform
Cashfree merchant receives the charge, retains the configured commission, and
allocates the rest to the hospital vendor. Doctor consultation fees remain a
separate hospital-side charge.

## Required Cashfree setup

1. Enable Easy Split on the ClickmyQ Cashfree merchant account and enable the
   Payment Gateway API for the **Sandbox** environment.
2. Obtain the Sandbox App ID and client secret. Do not use production
   credentials; the server currently targets Cashfree Sandbox only.
3. Configure the webhook URL as
   `https://<application-host>/api/cashfree/webhook` and subscribe to payment
   success, payment failure, refund status, and settlement events.
4. Have each hospital provide its Cashfree-required KYC and settlement account
   details. An authorized Super Admin enters these in Cashfree Easy Split
   onboarding. ClickmyQ sends the details to Cashfree and does not persist the
   supplied bank account or KYC fields.

## Server configuration

Choose one credentials source:

- Set `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET` together in the server
  environment. Environment credentials take precedence over stored credentials.
- Or configure the Sandbox credentials in Super Admin → Cashfree Easy Split.
  Before saving credentials through the UI, set
  `CASHFREE_CREDENTIALS_ENCRYPTION_KEY` to a randomly generated 32-byte
  base64-encoded key, for example from `openssl rand -base64 32`. Store this key
  in the deployment secret manager and keep it stable; changing it makes stored
  credentials undecryptable.

Never expose Cashfree credentials or the encryption key through browser
variables, logs, source control, or support screenshots. The Cashfree admin
screen only displays a masked App ID and never returns the secret.

## Database and operation

1. Apply pending migrations, including the online booking fee and Easy Split
   migrations, with `npx prisma migrate deploy`.
2. Generate Prisma Client with `npx prisma generate`.
3. In Super Admin → Cashfree Easy Split, set a percentage or fixed commission
   and register each hospital as a vendor. Sync vendor status after Cashfree
   onboarding completes; only `ACTIVE` vendors can receive split allocations.
4. Set each doctor's `onlineBookingFee` in Doctors Setup. The appointment
   checkout amount is re-read from the database, and the platform commission
   and vendor allocation are calculated server-side.
5. Test order creation, hosted checkout, server verification, signed webhooks,
   vendor split, refunds, and settlement status with Sandbox credentials before
   opening public appointment booking.
6. Authorized Super Admins can inspect recent split payments and initiate
   partial or full refunds from the Cashfree Easy Split screen. Refund balance
   reservations are server-checked and remain reserved while Cashfree is
   processing a request.

Production payment processing is intentionally unavailable in the current
implementation. Do not switch to production credentials or enable live
payments without explicit approval and a separate production readiness review.
