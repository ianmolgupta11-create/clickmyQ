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
