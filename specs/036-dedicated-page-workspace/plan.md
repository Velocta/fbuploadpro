# Plan: Spec 036 — Dedicated Facebook Page Workspace

## 1. Architecture & Component Blueprint

### A. Layout Structure
```
TenantDedicatedPageView (/tenant/[subdomain]/pages/[pageId])
├── PageHeader (Breadcrumbs, Avatar, Title, Account, StatusDot, Live Link, Actions)
│   ├── Pause/Resume Toggle Button
│   ├── Add to Queue Button (opens EnqueueMediaModal)
│   └── PageSettingsDropdown (Disconnect Page Dialog)
└── TabsContainer (value: dashboard | queue | calendar | insights | settings)
    ├── TabDashboard (Overview cards, next post countdown, upcoming queue snapshot, active slots)
    ├── TabQueue (Full queue list, inline caption/comment edit modal, publish-now trigger, remove)
    ├── TabCalendar (Recurring slots list, AddSlotModal, Delete slot action)
    ├── TabInsights (Time-series chart, video performance, reactions breakdown, demographics)
    └── TabSettings (Automation master switch, token status, disconnect action)
```

---

## 2. API & Data Contracts

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/tenant/[subdomain]/pages/[pageId]` | Fetch single page metadata, followers, status |
| `PATCH` | `/api/tenant/[subdomain]/pages/[pageId]` | Update page automation status (`active` / `paused`) |
| `DELETE` | `/api/tenant/[subdomain]/pages/[pageId]` | Soft-delete page, wipe token, cancel queued items |
| `GET` | `/api/tenant/[subdomain]/publishing/queue?pageId=[pageId]` | Fetch page's queued publishing items |
| `POST` | `/api/tenant/[subdomain]/publishing/queue/[itemId]/publish-now` | Trigger immediate edge publication |
| `PATCH` | `/api/tenant/[subdomain]/publishing/queue/[itemId]` | Update caption and first comment |
| `DELETE` | `/api/tenant/[subdomain]/publishing/queue/[itemId]` | Remove item from queue |
| `GET` | `/api/tenant/[subdomain]/pages/[pageId]/slots` | List recurring publishing slots |
| `POST` | `/api/tenant/[subdomain]/pages/[pageId]/slots` | Add new recurring publishing slot |
| `DELETE` | `/api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]` | Delete publishing slot |
| `GET` | `/api/tenant/[subdomain]/pages/[pageId]/insights?range=[7d\|14d\|28d]` | Follower growth, video stats, reactions |

---

## 3. Component Hierarchy (`apps/web/src/components/pages/dedicated/`)

1. `page-header.tsx`: Header banner with avatar, live link, status dot, and primary action buttons.
2. `tab-dashboard.tsx`: Overview metric cards, next post countdown, upcoming queue snapshot, active slots.
3. `tab-queue.tsx`: Queue item cards with thumbnail, caption, first comment, publish-now button, and edit modal.
4. `tab-calendar.tsx`: Recurring slot manager with time-picker creation modal and active toggles.
5. `tab-insights.tsx`: Growth and engagement analytics powered by Recharts with range switcher.
6. `tab-settings.tsx`: Master automation switch, token health, and safe disconnect dialog.
7. `index.ts`: Clean barrel exports for the dedicated page workspace.
