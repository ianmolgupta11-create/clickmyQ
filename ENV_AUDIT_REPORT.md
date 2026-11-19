# Environment Variable Audit Report

## Scope and method

This audit was produced by scanning the actual repository source code, Prisma schema, deployment-related config, and runtime service code. The original `.env` file was not inspected or used to populate this report because the requirement was to reconstruct the environment structure from source code and to avoid exposing any real secret material.

The application code in this repository uses a mixed set of:
- framework/runtime vars (`NODE_ENV`, `NEXT_PHASE`)
- local development toggles (`DEV_UNLOCK_PLANS`)
- Prisma/database config (`DATABASE_URL`)
- JWT/session security (`JWT_SECRET`, `SESSION_SECRET`)
- production platform settings (`NEXT_PUBLIC_APP_URL`, `SUPER_ADMIN_*`)
- email and SMS delivery (`EMAIL_*`, `SMTP_*`, `TWILIO_*`)
- payment provider config (`CASHFREE_*`)
- AI service config (`GEMINI_API_KEY`, `OPENROUTER_*`, `OPENAI_API_KEY`)
- Cloudinary uploads (`CLOUDINARY_*`)
- customer/support form hooks (`GOOGLE_SHEET_WEBHOOK_URL`, `HOSPITAL_*`)

## Summary

- Total discovered environment variables: 34
- Required in production by current validation rules: 16
- Optional / local development / feature-gated: 18
- Variables whose original values cannot be recovered from source: all secret values must be regenerated or restored from provider/secret-manager records; no real secrets are embedded in this repository
- Missing values in the repo source: none for active runtime configuration; some variables are framework-generated or auto-injected by Next.js and are not usually set manually

## Variable Inventory by category

### 1) Application configuration

- NODE_ENV
  - Used in: backend/config/db.ts, backend/config/plans.ts, backend/utils/env-validation.ts, backend/utils/sms.ts, backend/services/otp.service.ts, src/middleware.ts
  - Purpose: Runtime mode flag for local dev vs production.
  - Required: No (framework-provided; usually auto-set)
  - Public/secret: Public runtime flag
  - Default: development in local environment

- NEXT_PHASE
  - Used in: backend/config/env.ts
  - Purpose: Next.js build-phase marker used during build-time validation.
  - Required: No
  - Public/secret: Public metadata
  - Default: unset outside Next.js build phases

- NEXT_PUBLIC_APP_URL
  - Used in: backend/utils/env-validation.ts, backend/services/ai.service.ts, backend/services/blog.service.ts, src/app/api/config/.../send-credentials/route.ts, src/app/api/public/booking/route.ts, src/app/api/book-demo/route.ts, other route files that build login links
  - Purpose: Public app base URL for links and AI headers.
  - Required: Yes in production
  - Public/secret: Public URL
  - Example: http://localhost:3000

- DEV_UNLOCK_PLANS
  - Used in: backend/config/plans.ts, backend/utils/env-validation.ts
  - Purpose: Locally unlock all paid features during development.
  - Required: No, local-only
  - Public/secret: Public config flag
  - Valid values: true|false

### 2) Database / Prisma

- DATABASE_URL
  - Used in: backend/config/db.ts, backend/config/env.ts, prisma/schema.prisma
  - Purpose: Prisma/MySQL database connection string.
  - Required: Yes
  - Public/secret: Secret
  - Example: mysql://user:pass@host:3306/dbname?charset=utf8mb4&parseTime=true

### 3) Authentication and JWT

- JWT_SECRET
  - Used in: backend/config/env.ts, backend/utils/env-validation.ts, backend/utils/jwt.ts, src/middleware.ts
  - Purpose: JWT signing key for authenticated backend routes.
  - Required: Yes in production
  - Public/secret: Secret
  - Example: long random string, minimum 10 chars

- SESSION_SECRET
  - Used in: backend/config/env.ts, backend/utils/env-validation.ts
  - Purpose: Session cookie signing secret.
  - Required: Yes in production
  - Public/secret: Secret
  - Example: long random string, minimum 10 chars

### 4) Super Admin

- SUPER_ADMIN_EMAIL
  - Used in: backend/utils/env-validation.ts, src/app/api/book-demo/route.ts
  - Purpose: Destination email for operational alerts and demo requests.
  - Required: Yes in production
  - Public/secret: Semi-public contact address

- SUPER_ADMIN_PASSWORD
  - Used in: backend/utils/env-validation.ts
  - Purpose: Platform super-admin credential bootstrap / validation.
  - Required: Yes in production
  - Public/secret: Secret

- SUPER_ADMIN_SECURITY_KEY
  - Used in: backend/utils/env-validation.ts
  - Purpose: Super-admin security key / bootstrap secret.
  - Required: Yes in production
  - Public/secret: Secret

### 5) Email / SMTP

- EMAIL_HOST
  - Used in: backend/utils/env-validation.ts, backend/services/otp.service.ts, src/app/api/book-demo/route.ts, src/app/api/subdept/queue/route.ts
  - Purpose: SMTP server hostname.
  - Required: Yes in production
  - Public/secret: Secret-ish but not a credential value itself
  - Example: smtp.gmail.com

- EMAIL_PORT
  - Used in: backend/services/otp.service.ts, src/app/api/book-demo/route.ts
  - Purpose: SMTP port.
  - Required: No, but recommended; defaults are used in code
  - Public/secret: Public transport metadata
  - Default: 587

- EMAIL_USERNAME
  - Used in: backend/utils/env-validation.ts, backend/utils/mailer.ts, backend/services/otp.service.ts, src/app/api/book-demo/route.ts
  - Purpose: SMTP username / sender account.
  - Required: Yes in production
  - Public/secret: Semi-secret account credential

- EMAIL_PASSWORD
  - Used in: backend/utils/env-validation.ts, backend/utils/mailer.ts, backend/services/otp.service.ts, src/app/api/book-demo/route.ts
  - Purpose: SMTP password.
  - Required: Yes in production
  - Public/secret: Secret

- SMTP_USER
  - Used in: backend/utils/mailer.ts
  - Purpose: Compatibility alias for SMTP username.
  - Required: No when EMAIL_USERNAME is set
  - Public/secret: Secret alias

- SMTP_PASS
  - Used in: backend/utils/mailer.ts
  - Purpose: Compatibility alias for SMTP password.
  - Required: No when EMAIL_PASSWORD is set
  - Public/secret: Secret alias

### 6) SMS / OTP

- TWILIO_ACCOUNT_SID
  - Used in: backend/services/otp.service.ts, backend/utils/env-validation.ts, backend/utils/sms.ts
  - Purpose: Twilio account identifier.
  - Required: Yes in production for SMS OTP
  - Public/secret: Secret

- TWILIO_AUTH_TOKEN
  - Used in: backend/services/otp.service.ts, backend/utils/env-validation.ts, backend/utils/sms.ts
  - Purpose: Twilio auth token.
  - Required: Yes in production for SMS OTP
  - Public/secret: Secret

- TWILIO_PHONE_NUMBER
  - Used in: backend/services/otp.service.ts, backend/utils/env-validation.ts, backend/utils/sms.ts
  - Purpose: Sender phone number used for SMS OTP.
  - Required: Yes in production for SMS OTP
  - Public/secret: Phone number metadata, not a secret

### 7) Payment gateways

- CASHFREE_ENV
  - Used in: backend/services/cashfree-booking.service.ts
  - Purpose: Cashfree runtime mode (`sandbox` or `production`).
  - Required: No, but required when online payments are enabled.
  - Public/secret: Public mode flag

- CASHFREE_APP_ID
  - Used in: backend/services/cashfree-booking.service.ts
  - Purpose: Cashfree application ID.
  - Required: Yes when online payments are enabled
  - Public/secret: Secret-ish credential

- CASHFREE_SECRET_KEY
  - Used in: backend/services/cashfree-booking.service.ts
  - Purpose: Cashfree secret key.
  - Required: Yes when online payments are enabled
  - Public/secret: Secret

### 8) AI services

- GEMINI_API_KEY
  - Used in: backend/services/ai.service.ts, backend/services/complaint-summary.service.ts, backend/services/voice-prescription.service.ts, backend/utils/ai-procedures.ts, list-models.js
  - Purpose: Google Gemini API access key for AI prescription and analysis features.
  - Required: No (fallbacks exist to OpenRouter)
  - Public/secret: Secret

- OPENAI_API_KEY
  - Used in: test-openai.js
  - Purpose: Direct OpenAI testing utility, not an active runtime dependency in application routes.
  - Required: No
  - Public/secret: Secret

- OPENROUTER_API_KEY
  - Used in: backend/services/ai.service.ts, backend/services/blog.service.ts, backend/services/complaint-summary.service.ts, backend/services/voice-prescription.service.ts, backend/utils/ai-procedures.ts, src/app/api/chat/route.ts
  - Purpose: OpenRouter API key used as AI fallback and blog generation provider.
  - Required: No (fallbacks and route-level error handling exist)
  - Public/secret: Secret

- OPENROUTER_HTTP_REFERER
  - Used in: backend/services/ai.service.ts
  - Purpose: Referer header sent to OpenRouter.
  - Required: No, defaults to `NEXT_PUBLIC_APP_URL` or localhost fallback
  - Public/secret: Public URL header

- OPENROUTER_X_TITLE
  - Used in: backend/services/ai.service.ts
  - Purpose: App title sent to OpenRouter for provider attribution.
  - Required: No
  - Public/secret: Public string

### 9) File storage

- CLOUDINARY_CLOUD_NAME
  - Used in: backend/utils/cloudinary.ts, backend/utils/env-validation.ts, src/app/api/upload/file/route.ts
  - Purpose: Cloudinary account cloud name.
  - Required: Yes in production
  - Public/secret: Cloud identifier (not highly secret, but required)

- CLOUDINARY_API_KEY
  - Used in: backend/utils/cloudinary.ts, backend/utils/env-validation.ts, src/app/api/upload/file/route.ts
  - Purpose: Cloudinary API key.
  - Required: Yes in production
  - Public/secret: Secret

- CLOUDINARY_API_SECRET
  - Used in: backend/utils/cloudinary.ts, backend/utils/env-validation.ts, src/app/api/upload/file/route.ts
  - Purpose: Cloudinary API secret.
  - Required: Yes in production
  - Public/secret: Secret

### 10) External APIs and support config

- HOSPITAL_NAME
  - Used in: src/app/api/enquiries/route.ts
  - Purpose: Default hospital display name for enquiry emails.
  - Required: No, falls back to defaults in code
  - Public/secret: Public contact metadata

- HOSPITAL_EMAIL
  - Used in: src/app/api/enquiries/route.ts
  - Purpose: Email recipient for hospital notifications.
  - Required: No, falls back to default email address in code
  - Public/secret: Operational contact address

- HOSPITAL_PHONE
  - Used in: src/app/api/enquiries/route.ts
  - Purpose: Default hospital phone number displayed in enquiry flows.
  - Required: No
  - Public/secret: Public contact metadata

- GOOGLE_SHEET_WEBHOOK_URL
  - Used in: src/app/api/enquiries/route.ts
  - Purpose: Apps Script URL for pushing enquiries into a Google Sheet.
  - Required: No
  - Public/secret: URL endpoint; may be considered operational metadata

## Cross-check against the source code

### Variables present in the source and included in the template

All 34 variables discovered from actual source files are included in the reconstructed .env example.

### Dynamic or indirect access

- `CLOUDINARY_ENV_VARS` in backend/utils/cloudinary.ts validates multiple keys via a list and dynamic access `process.env[k]`.
- The source uses framework variables `NODE_ENV` and `NEXT_PHASE` that are typically injected by Next.js, not manually set in `.env` files.
- `EMAIL_USERNAME`/`EMAIL_PASSWORD` and `SMTP_USER`/`SMTP_PASS` are alternate names used at different call sites; both are represented and documented as aliases.

### Potential missing or unused variables

- There are no missing variables in the active runtime code that are referenced by a direct `process.env.X` expression.
- `OPENAI_API_KEY` is referenced only in a standalone test utility and is optional/developer-only.
- `NEXT_PHASE` and `NODE_ENV` are auto-supplied by the runtime rather than user-created configuration.
- `SMTP_USER` and `SMTP_PASS` are not strictly separate logical config values; they are compatibility aliases for the main `EMAIL_*` variables.

## Production validation and warnings

The repository contains production checks in backend/utils/env-validation.ts that fail fast when critical values are missing. The following set is treated as production-required by code:

- DATABASE_URL
- JWT_SECRET
- SESSION_SECRET
- NEXT_PUBLIC_APP_URL
- SUPER_ADMIN_EMAIL
- SUPER_ADMIN_PASSWORD
- SUPER_ADMIN_SECURITY_KEY
- EMAIL_HOST
- EMAIL_USERNAME
- EMAIL_PASSWORD
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Additional values are optional and can be safely left unset when their features are not active.

## Manual verification required before deployment

Before running a production deployment, confirm the following values with your infrastructure provider or secret manager:

- DATABASE_URL (MySQL/RDS/hosted database)
- JWT_SECRET and SESSION_SECRET (strong random strings)
- NEXT_PUBLIC_APP_URL (production frontend URL)
- SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_SECURITY_KEY
- SMTP configuration (EMAIL_HOST, EMAIL_USERNAME, EMAIL_PASSWORD)
- Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
- Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
- Optional AI and payment credentials for the features you plan to enable (GEMINI_API_KEY, OPENROUTER_API_KEY, CASHFREE_*)

## Recovery status

The original `.env` values cannot be recovered from the repository because the repository does not embed production secrets and the original file is not available. Any real secret values must be replaced with freshly generated values from the correct providers or secret-management service.

## Final note

This template reflects the actual active code surface in the repository. It does not include arbitrary or guessed variables, and it intentionally excludes framework internals or generated build artifacts that do not appear in the source code used by the app.
