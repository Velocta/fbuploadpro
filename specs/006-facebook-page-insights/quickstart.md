# Quickstart & Verification Guide: Facebook Page Insights

**Feature**: Dedicated Facebook Page Insights & Analytics Suite
**Spec**: [specs/006-facebook-page-insights/spec.md](spec.md)

---

## 1. Automated Test Execution

Run the complete test suite across packages and applications:

```bash
# Run contracts schema validation tests
pnpm --filter @fbuploadpro/contracts test

# Run database migration & snapshot isolation tests
pnpm --filter @fbuploadpro/database test

# Run web app API proxy & UI component tests
pnpm --filter @fbuploadpro/web test

# Run worker background sync tests
pnpm --filter @fbuploadpro/worker test

# Full monorepo quality gate
pnpm turbo run build lint typecheck test
```

---

## 2. Manual API Validation (Local Dev)

### Fetch Page Insights Overview & Time-Series
```bash
curl -X GET "http://localhost:3000/api/tenant/myworkspace/pages/{pageId}/insights?range=28d" \
  -H "Cookie: fbuploadpro_session=VALID_SESSION_TOKEN"
```

### Assert Response Format
- HTTP status: `200 OK`
- Confirm `overview.fanCount` and `overview.followersCount` are numbers.
- Confirm `timeSeries` contains 28 chronological daily items.
- Confirm `reactions` contains sentiment counts.
- Confirm `demographics.topCountries` has ranked items with percentages summing to ~100%.
- Assert that **NO** access token is present in the response headers or body.

---

## 3. End-to-End API Validation

1. Query `GET /api/tenant/myworkspace/pages/[pageId]/insights?range=28d`.
2. Verify response contains `overview`, `timeSeries`, `reactions`, and `demographics`.
3. Verify `cacheStatus` returns `miss` on first request, then `hit` on subsequent query within 15 minutes.
4. Pass `refresh=true` and verify cache bypass.
