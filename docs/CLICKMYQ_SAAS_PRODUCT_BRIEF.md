# ClickmyQ SaaS Product Brief

## Executive Summary
ClickmyQ  is a Next.js/Prisma healthcare SaaS platform serving hospitals, doctors, staff, and patients. It includes OPD queue management, appointment booking, prescriptions, billing, pharmacy/IPD, and a public hospital marketplace. Many core modules are implemented; AI Rx, sponsored search, and payments are partial or config-dependent.

## Product Overview
- Vision: digitize hospital OPD and patient journey in India.
- Target market: Indian hospitals/clinics, patients.
- Value prop: online booking, live queue tokens, notifications, marketplace discovery.

## Modules
See feature inventory. Each module status labeled there.

## Pricing (Proposed)
- Basic: ₹499/hospital/month
- Top Tier: ₹1,299/hospital/month
Verified plan limits in code: STARTER (3 doctors, no IPD/pharmacy/AI), PROFESSIONAL (25 doctors, all), ENTERPRISE (unlimited). Proposed packaging maps Basic→Starter, Top Tier→Professional/Enterprise (assumption).

## Architecture
- Stack: Next.js 14, React, TypeScript, Prisma, PostgreSQL, Tailwind.
- Auth: JWT/session, RBAC.
- Integrations: Twilio SMS, SMTP email, Razorpay, Cloudinary, OpenAI/Gemini.
- Multi-tenancy: Hospital-scoped data via hospitalId (verify isolation).


## MiroFish Simulation
# ClickmyQ MiroFish Simulation Specification

## Agent Types
1. Patient
2. Hospital Admin
3. Doctor
4. Staff
5. Platform (ClickmyQ)
6. Marketplace Sponsor

## Attributes & Goals
- Patient: location, insurance, urgency, price sensitivity, seeks low wait time.
- Hospital Admin: capacity, plan tier, adoption goals, churn risk.
- Doctor: availability, specialties, interruption tolerance.
- Staff: throughput, check-in speed.
- Platform: MRR growth, fairness, uptime.
- Sponsor: budget, target specialties, ROI.

## Interactions
- Onboarding: platform ↔ hospital admin
- Discovery/booking: patient ↔ marketplace/hospital
- Queue: patient ↔ staff/doctor
- Emergency: doctor interruption, priority override, notifications
- Subscription: admin ↔ platform
- Sponsored search: sponsor ↔ platform ↔ patient

## Scenarios
1. Baseline launch
2. Hospital onboarding growth
3. Patient adoption/retention
4. Pricing sensitivity Basic vs Top Tier
5. AI Rx adoption
6. Emergency demand surge
7. Sponsored search monetization
8. Marketplace trust/fairness
9. Outage/recovery

## KPIs
- Patient acquisition, conversion, retention, NPS
- Hospital onboarding count, subscription mix, churn, ROI
- Booking volume, no-shows, queue time, utilization
- MRR, sponsored revenue, CAC, profitability
- AI Rx review/correction/safety rates
- Emergency response time, queue fairness
- Marketplace relevance, sponsor CTR/ROI

Baseline values: not available (no production metrics in repo). All parameters hypothetical for simulation.


## Audit Summary
Inspected README, package.json, prisma schema/migrations, API routes, plans config, marketplace pages. Could not verify end-to-end tests (none), production config, or live integrations.


# ClickmyQ Feature Inventory

## Legend
- **Implemented & verified**: code present and wired end-to-end
- **Implemented but unverified**: code present, not validated by tests
- **Partial**: incomplete or stubbed
- **Planned**: not implemented
- **Blocked**: depends on external config

## Core Platform
| Feature | Status | Key Files |
|---|---|---|
| Next.js App Router frontend | Implemented & verified | `src/app/**` |
| Prisma/PostgreSQL data layer | Implemented & verified | `prisma/schema.prisma` |
| JWT/session auth | Implemented & verified | `src/lib/auth*.ts`, `backend/middlewares/*` |
| Role-based access | Implemented & verified | `src/middleware.ts`, `backend/middlewares/*` |

## Patient Portal
| Feature | Status | Key Files |
|---|---|---|
| Patient registration OTP | Implemented & verified | `src/app/api/patient/auth/register-*` |
| Patient login OTP | Implemented & verified | `src/app/api/patient/auth/*` |
| Patient dashboard | Implemented & verified | `src/app/patient/dashboard/page.tsx` |
| Patient appointments | Implemented & verified | `src/app/api/patient/me/appointments/route.ts` |
| Patient prescriptions | Implemented & verified | `src/app/api/patient/me/prescriptions/route.ts` |
| Patient bills | Implemented & verified | `src/app/api/patient/me/bills/route.ts` |
| Patient queue status | Implemented & verified | `src/app/api/patient/me/queue/route.ts` |
| Public hospital profile | Implemented & verified | `src/app/patient/[slug]/page.tsx` |

## Hospital Admin
| Feature | Status | Key Files |
|---|---|---|
| Hospital onboarding | Implemented & verified | `src/app/api/hospital/create/route.ts` |
| Marketplace listing config | Implemented & verified | `src/app/hospitaladmin/configure/page.tsx` |
| Subscription management | Implemented & verified | `src/app/api/superadmin/hospitals/[id]/subscription/route.ts` |

## Clinical
| Feature | Status | Key Files |
|---|---|---|
| Appointment booking | Implemented & verified | `src/app/api/appointments/*` |
| Live queue / tokens | Implemented & verified | `src/app/api/appointments/queue/route.ts`, `stream` |
| Check-in | Implemented & verified | `src/app/api/appointments/[id]/checkin/route.ts` |
| Delay alerts | Implemented & verified | `src/app/api/appointments/delay-alert/*` |
| Doctor interruption status | Implemented & verified | migration `add_doctor_interruption_status` |
| Prescriptions | Implemented & verified | `src/app/api/prescriptions/*` |
| AI Rx assist | Partial | `src/app/api/prescriptions/ai-assist/route.ts` |
| Complaint summary (voice) | Partial | `src/app/api/prescriptions/complaint-summary/route.ts`, `VoiceComplaintSummarizer` |

## Marketplace
| Feature | Status | Key Files |
|---|---|---|
| Public listing / search | Implemented & verified | `src/app/patient/[slug]`, `find_hospital.*` |
| Superadmin listing governance | Implemented & verified | `src/app/superadmin/listings/page.tsx` |
| Sponsored placements | Partial/Planned | inspect `administrative/dashboard/marketplace/page.tsx` |

## Billing
| Feature | Status | Key Files |
|---|---|---|
| Razorpay integration | Implemented but unverified (dev bypass) | `backend/services/razorpay.service.ts` |
| Subscription plans | Implemented & verified | `backend/config/plans.ts` |
| SubscriptionPayment model | Implemented & verified | `prisma/schema.prisma` |

## AI
| Feature | Status | Key Files |
|---|---|---|
| Chat | Implemented but unverified | `src/app/api/chat/route.ts` |
| AI staff salary suggest | Implemented but unverified | `src/app/api/config/staff/ai/*` |

