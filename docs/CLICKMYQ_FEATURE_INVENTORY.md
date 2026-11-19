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

