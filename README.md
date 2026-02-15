## API Design

1. Logging + Observability ✅
2. Error Handling ✅
3. State ❌
4. Caching ❌
5. Types + Models ✅
6. Database ✅
7. Services✅
8. Repositories ✅
9. CICD ❌
10. Routes✅
11. Graceful shutdown ✅
12. Security: Helmet + Cors + Compression + Ratelimiting ✅
13. Middleware ✅
14. Validation ✅
15. Auth ✅
16. Linting + Formatting ✅
17. Documentation + API Docs ❌
18. Timeouts + Retries ❌
19. Feature Folder structure -> Features/Infra/Shared ✅
20. Job Queue setup ✅

## Lock-In Backend

- Node.js + Express.js for request handling
- Supabase for Database
- Supabase for Auth
- Drizzle for ORM
- Zod for validation
- Meebo ( my library) for Swagger Docs + automatic zod validation
- Winston + Sentry Plugin for logging
- Stripe for payment handling
- Redis message broker for the job queue
- BullMQ for queue and worker orchestration

## Features

- Commitments: Users can commit to working out for a duration/frequency
  i.e (walk 5x a week for 2 weeks)
- Payments: Users can stake money on completing their commitment (20$ staked)
- Payouts: Successful completion of a commitment refunds user their initial bet (extra bonus coming in v2)
- Forfeits: Losing a commitment forfeits your money and gets added to pool
- Commitment Sessions: Users can record sessions like strava for walking/running
- each recorded commitment sends session samples like gps coords and motion data to backend for verification
- Verification Pipeline: Analyzes session data for fraud detection like inhuman speeds, etc
  runs in async job queue by Bullmq workers, shares event loop with main thread though. (Concurrent not parallel which is fine for i/o based work)
- transactions created for each type of money movement and pool is a running balance of money and stakes held
