This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. `.env*` is gitignored — never commit real secrets.

| Variable | Purpose | If blank |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | App cannot start |
| `JWT_SECRET`, `SESSION_SECRET` | Token signing | Falls back to an insecure default |
| `NEXT_PUBLIC_APP_URL` | Public base URL | — |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD` | SMTP (Gmail) | **DEV-BYPASS** — emails print to the server console |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS OTPs | **DEV-BYPASS** — OTPs print to the server console |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Online payments | **DEV-BYPASS** — payments are simulated (no checkout popup, no real charge) |
| `DEV_BYPASS_PAYMENT` | Force the payment dev-bypass even when keys are set | `false` — bypass is then automatic only while no keys are configured |
| `DEV_UNLOCK_PLANS` | Unlock every premium plan feature for all hospitals while developing | `false` — real plan limits (IPD / pharmacy / AI prescription / doctor caps) still apply |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | File uploads (logos, photos, prescriptions, inventory images) | Uploads return **HTTP 503** |

### Cloudinary setup

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Go to **Settings → API Keys** and copy the **Cloud name**, **API key** and **API secret**.
3. Paste them into `.env`:

   ```bash
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   ```

4. Restart the dev server — Next.js reads `.env` only at boot.

Only the three values above are needed: uploads are proxied through the Next.js server, so the API secret never reaches the browser. Cloudinary's separate *App secret* is only required for browser-side signed uploads, which this app does not use.

Images (logo, doctor/patient photos, inventory images, signature, stamp) are served straight from the Cloudinary CDN. **Documents (PDF) are not publicly deliverable by default** — Cloudinary's delivery ACL rejects them with a 401 — so they are streamed through the authenticated route `GET /api/upload/file?publicId=…` instead. This also keeps patient documents and prescriptions private rather than publicly linkable. Links to documents are rewritten automatically by the `deliveryUrl()` helper in `src/lib/cloudinary.ts`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
