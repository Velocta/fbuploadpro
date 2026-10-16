# Quickstart & Verification Guide: Live Facebook Insights

**Feature**: [spec.md](./spec.md)
**Date**: 2026-10-16

---

## Scenario 1: Initial Visit and LocalStorage Ingestion

1. Navigate to dedicated page workspace: `/tenant/{subdomain}/pages/{pageId}`.
2. Click the **Insights** tab.
3. Assert that since `localStorage` is empty for this page, the loading skeleton appears briefly while `/api/tenant/{subdomain}/pages/{pageId}/insights?range=28d` executes.
4. Verify the response is stored in `localStorage` under key `insights:${pageId}:28d` with `{ data, cachedAt, expiresAt }`.
5. Verify the 4 KPI cards, time-series trajectory chart, reactions breakdown, and top audience countries display properly.

---

## Scenario 2: Instant Cache Resumption on Refresh

1. With `localStorage` populated from Scenario 1, hit browser Refresh (F5 / Cmd+R).
2. Switch to or observe the **Insights** tab.
3. Assert that data loads immediately from `localStorage` without skeleton loading flash.
4. Open the browser Network tab and verify that **zero** requests were sent to `/api/tenant/.../insights`.

---

## Scenario 3: Manual "Sync" Bypass

1. On the **Insights** tab with existing cached data, click the **Sync** button.
2. Assert that the sync icon starts spinning and label changes to **Syncing...**.
3. Verify that a network request is issued to `/api/tenant/{subdomain}/pages/{pageId}/insights?range=28d&refresh=true`.
4. Once the request resolves, verify:
   - The UI updates with fresh numbers.
   - `localStorage.getItem('insights:${pageId}:28d')` contains the new data with an updated `expiresAt` set to 15 minutes in the future.

---

## Scenario 4: Automatic 15-Minute Expiration

1. Artificially set `expiresAt` in `localStorage` to a timestamp in the past (`Date.now() - 1000`).
2. Refresh the page or click a different range and click back to `28d`.
3. Assert that because the entry has expired, the client triggers a background fetch to the server, revalidates with live Facebook Graph API, and writes a fresh unexpired entry.
