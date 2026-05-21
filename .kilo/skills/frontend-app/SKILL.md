---
name: frontend-app
description: Build and modify the React frontend for the document translation platform. Use this skill whenever the user asks to create frontend pages, React components, routing, authentication UI, forms, state management, i18n strings, or any client-side code. Also use this skill when the user mentions frontend, React, page, component, UI, form, routing, tanstack query, React Router, shadcn, or asks to build any frontend feature from the docs. Even if the user just says "add a page" or "create a component", use this skill. For visual styling and aesthetics, invoke the `frontend-design` skill after building structure with this skill.
---

# Frontend Application

This skill governs the document translation platform's React frontend. It handles structure, routing, state, components, forms, and data fetching. For visual styling (typography, colors, motion, spatial composition), invoke the `frontend-design` skill on top of the structure this skill produces.

**Always read `references/conventions.md` after this file** — it contains reusable code patterns, guard implementations, TanStack Query hooks, form templates, and the SSE hook.

## Two-Skill Workflow

When building a page or component:

1. **Build structure with `frontend-app`** (this skill) — routing, state, data fetching, form logic, component hierarchy, loading/empty/error states, edge cases
2. **Apply styling with `frontend-design`** — typography, color scheme, motion, spatial composition, visual polish

Both skills should be used together for any frontend task. Neither alone is sufficient.

## Quick Reference: Which Doc to Read

When a user asks about a specific topic, consult the corresponding doc before writing code:

| User asks about... | Read this doc |
|---|---|
| Tech stack, state management, layout, i18n, breakpoints | `docs/frontend/overview.md` |
| Auth flow, API client, route guards, layouts, theming | `docs/frontend/foundation.md` |
| Routes, paths, guards, redirects, breadcrumbs, 404 | `docs/frontend/routing.md` |
| Auth flow, tokens, login/signup, OAuth, session timeout | `docs/frontend/auth.md` |
| Any shared component (DropZone, DataTable, StatusBadge, etc.) | `docs/frontend/components.md` |
| Universal states (loading, empty, error, toast, edge cases) | `docs/frontend/states.md` |
| Public pages (home, login, signup, pricing, etc.) | `docs/frontend/public/<page>.md` |
| Dashboard pages (translate, translations, batch, etc.) | `docs/frontend/dashboard/<page>.md` |
| Settings pages (profile, notifications, security, billing) | `docs/frontend/settings/<page>.md` |
| Team pages (overview, members, billing, settings) | `docs/frontend/team/<page>.md` |
| Admin pages (providers, plans, users, analytics, etc.) | `docs/frontend/admin/<page>.md` |

---

## Tech Stack

These are non-negotiable. Every frontend file uses this stack:

| Concern | Library | Version |
|---|---|---|
| Framework | React + TypeScript | 18+ |
| UI primitives | shadcn/ui + TailwindCSS | 4 |
| Server state | TanStack Query (React Query) | v5 |
| Routing | React Router | v6 |
| Forms | React Hook Form + Zod | latest |
| i18n | react-i18next | latest |
| Theme | next-themes | latest |
| Icons | Lucide React | latest |
| Charts | Recharts (admin only) | latest |
| Toasts | Sonner (shadcn/ui default) | latest |

**Hard rules:**
- All UI must use shadcn/ui primitives. Custom components only where shadcn/ui doesn't cover the need.
- All forms use Zod schema + React Hook Form. No manual form state.
- All text goes through react-i18next. No hardcoded English strings.
- All colors use Tailwind semantic tokens. No hex/rgb literals.
- All API data goes through TanStack Query. No manual fetch/useEffect for server data.
- Size limits: files ≤ 200 lines, components ≤ 150 lines, hooks/utilities ≤ 50 lines. Split oversized code into smaller focused files.

---

## State Architecture

### Context Providers (wrap the app root)

| Context | Stores | Persistence |
|---|---|---|
| AuthContext | user, accessToken, isAuthenticated, isVerified, role | accessToken in memory only (refresh in httpOnly cookie) |
| ThemeContext | theme (light/dark/system), resolvedTheme | localStorage |
| I18nContext | currentLanguage, dir (ltr/rtl) | localStorage |
| SidebarContext | expanded / collapsed / hidden | localStorage |
| TeamContext | activeTeamId, activeTeamRole | session (resolved from user on login) |

AuthContext is the most important — every authenticated route depends on it. Implement it with a provider, a `useAuth()` hook, and automatic token refresh logic.

### TanStack Query Rules
- Stale time: 30 seconds for lists, 5 minutes for single resources
- Invalidate queries on mutation success
- Background refetch on window focus
- Paginated queries use `keepPreviousData: true`
- Query key convention: `["resource", "list", filters]` and `["resource", id]`
- Mutation key convention: `["resource", "create"]`, `["resource", "update", id]`

---

## Routing

### Route File Structure

All routes in `frontend/src/routes.tsx` or a routes directory. Every route follows this pattern:

```tsx
<Route path="/dashboard" element={<AuthenticatedGuard />}>
  <Route index element={<DashboardHome />} />
  <Route path="translate" element={<NewTranslation />} />
  <Route path="translations" element={<TranslationHistory />} />
  <Route path="translations/:jobId" element={<TranslationDetail />} />
  <Route path="batch" element={<PlanGate feature="batch"><BatchTranslation /></PlanGate>} />
  <!-- ... -->
</Route>
```

### Route Guards

Six guards. Each wraps children and either renders them or redirects:

| Guard | Wraps | Redirect on fail | When to use |
|---|---|---|---|
| `GuestOnly` | Public auth pages | `/dashboard` if authenticated | Login, signup, forgot-password, reset-password |
| `Authenticated` | All dashboard/settings/team routes | `/login?redirect=<current>` if unauthenticated | Dashboard, settings, team |
| `Admin` | Admin routes | `/dashboard` if role !== ADMIN | All `/admin/*` routes |
| `TeamMember` | Team routes | `/dashboard` if not in team | Team overview, members, glossaries |
| `TeamOwner` | Team billing/settings | 403 page if role !== OWNER | Team billing, settings |
| `PlanGate(feature)` | Feature-gated routes | Upgrade prompt if plan lacks feature | Batch, glossaries, webhooks, API keys |

The full route table with all 50+ paths and their guards is in `docs/frontend/routing.md`. Consult it before adding any route — the path, params, and guard are already specified.

### Route Behaviors
- Scroll to top on route change
- Breadcrumbs generated from route segments
- Sidebar highlights active route
- Page title: `{Page Name} — Document Translator`
- 404 page is context-aware (shows "Go to Dashboard" if authenticated, "Go to Home" if not)

---

## Auth System

### Token Handling
- **Access token**: JWT, 15-minute expiry, stored in React state (memory only), sent as `Authorization: Bearer <token>`
- **Refresh token**: 7-day expiry, httpOnly Secure SameSite=Strict cookie, not JS-accessible
- **Token refresh on 401**: Interceptor detects 401 → `attemptRefresh()` → POST `/api/v1/auth/refresh` → new accessToken, or clear auth + redirect to `/login`
- **Proactive silent refresh**: Timer at 12 minutes → silent POST refresh to prevent gaps

### Auth State Machine
```
NOT AUTHENTICATED → LOGIN → AUTHENTICATED, VERIFIED
NOT AUTHENTICATED → SIGNUP → AUTHENTICATED, UNVERIFIED (banner)
UNVERIFIED → verify email → AUTHENTICATED, VERIFIED
```

Unverified users see a persistent banner on all authenticated pages. They can translate but cannot use batch, glossaries, API keys, webhooks, teams, or billing.

### Post-Login Redirect
If a user was redirected to `/login?redirect=/dashboard/batch`, they go to `/dashboard/batch` after login.

### Session Expiry
Refresh token fails → clear auth + toast "Your session has expired" → redirect to `/login?redirect=<current>`.

### Logout
POST `/api/v1/auth/logout` → clear auth state + TanStack Query cache → redirect to `/` + toast.

Full auth flow details (including OAuth, password reset, email verification): `docs/frontend/auth.md`.

---

## Component Usage

### Shared Components (always use these, never rebuild)

Every shared component is documented in `docs/frontend/components.md`. Check it before building anything — you'll often find a component that does exactly what you need.

| Component | Use when |
|---|---|
| `DropZone` | Any file upload (home page, translate page, batch page) |
| `LanguageSelector` | Language picking (source, target, team defaults) |
| `ProgressBar` | Any async progress (translation, batch, upload) |
| `StatusBadge` | Job status display (queued, translating, completed, failed) |
| `DataTable` | Any table with data (translations, batches, members, users) |
| `EmptyState` | Any empty list or page (no translations, no glossaries, no members) |
| `ErrorState` | Any fetch error (API down, network error) |
| `LoadingSkeleton` | Loading states (table, card, detail, stats variants) |
| `ConfirmationDialog` | Destructive actions (delete, cancel, revoke) |
| `CopyButton` | Copyable text (API keys, webhook secrets, download URLs) |
| `SearchInput` | Any search (translations, glossaries, users, webhooks) — 300ms debounce |
| `Toggle` | Any on/off setting. Has a `locked` prop that shows a lock icon with tooltip. |
| `Breadcrumb` | Navigation context on every page |
| `PageUsageMeter` | Quota display (dashboard, billing, teams) |
| `PlanCard` | Pricing page, billing settings |
| `NotificationBell` | Navbar — bell icon with unread SSE badge |

### Page-Specific Components (documented per-page)
- `FilePreview` — after file drop, batch table
- `SideBySidePreview` — translation detail (completed state)
- `TranslationProgressWidget` — during active translation (SSE-driven)
- `WebhookEventSelector` — webhook create/edit
- `GlossaryTable` — glossary edit page (inline editable, duplicate detection)
- `ApiKeyModal` — API keys page (two-step: label → show key once)

The full catalog with props, states, and variants is in `docs/frontend/components.md`.

---

## Page Implementation Pattern

Every page follows this exact implementation order. This ensures all states are covered:

### Step 1: Define the Zod schema (if the page has a form)
```tsx
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

### Step 2: Define the TanStack Query hooks
```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ["translations", filters],
  queryFn: () => translationsApi.list(filters),
});
```

### Step 3: Build the happy path (data loaded, form valid)
- Render components with real data
- Wire form submission to mutation
- Show success toast on submit

### Step 4: Add loading state
- Use `LoadingSkeleton` with the variant matching the content type
- Forms: disable submit button, show spinner

### Step 5: Add empty state
- Use `EmptyState` with contextual icon, title, description, and CTA
- Message must be specific to the context (e.g., "No translations yet" not "No data")

### Step 6: Add error state
- Use `ErrorState` with error message and retry button
- Network errors: "Could not connect to server"
- API errors: pass through the error message from the response

### Step 7: Handle edge cases
- Consult `docs/frontend/states.md` for universal edge cases
- Consult the specific page doc for page-level edge cases

---

## Forms Pattern

Every form in the app uses this exact pattern:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => authApi.login(data),
    onSuccess: () => { /* redirect, set auth state */ },
    onError: (error) => { /* set server error, show toast */ },
  });

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <!-- shadcn/ui form field components -->
    </form>
  );
}
```

**Rules:**
- Always define Zod schema first, then derive TypeScript type from it
- Always disable submit button while `isSubmitting` is true
- Always show inline field errors from `formState.errors`
- Always show server errors from the API response above the submit button
- Always use `sonner` toast for success/error messages after redirects

---

## SSE (Server-Sent Events) Pattern

Used for real-time translation progress and notification updates:

```tsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

function useJobStream(jobId: string) {
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const { accessToken } = useAuth();

  useEffect(() => {
    function connect() {
      const url = `/api/v1/jobs/${jobId}/stream?token=${accessToken}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("status", (e) => {
        const data = JSON.parse(e.data);
        setStatus(data.status);
        setProgress(data.progress_pct);
        retryCountRef.current = 0;
      });

      es.addEventListener("error", (event) => {
        es.close();
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
        retryCountRef.current++;
        setTimeout(connect, delay);
      });
    }

    connect();
    return () => eventSourceRef.current?.close();
  }, [jobId, accessToken]);

  return { status, progress };
}
```

**Key details:**
- Auth token passed as query param `?token=<access_token>` because EventSource doesn't support custom headers
- Auto-reconnect with exponential backoff: 1s → 2s → 4s → 8s → max 30s
- Reset retry count on successful event
- Clean up EventSource on unmount
- Heartbeat: every 15 seconds from server

---

## i18n & Theme

### i18n Architecture
- 9 languages: en, es, fr, de, zh, ja, ko, ar, he (ar and he are RTL)
- Namespace JSON files: `public/locales/{lang}/{namespace}.json`
- Namespaces: `common`, `home`, `auth`, `dashboard`, `settings`, `team`, `admin`
- Detection: user's saved preference → browser `navigator.language` → English fallback
- RTL: `dir="rtl"` on `<html>`, use TailwindCSS logical properties

### Usage
```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation("dashboard");
  return <h1>{t("translate.title")}</h1>;
}
```

Never hardcode English text. Always use `t("key")` with the appropriate namespace.

### Theme
- Three modes: Light, Dark, System
- CSS custom properties on `:root` and `.dark`
- Transitions: `transition-colors duration-200`
- Toggle component: `ThemeToggle` — Sun/Moon/System three-state

---

## Responsive Layout

### Breakpoints
| Breakpoint | Width | Sidebar | Content |
|---|---|---|---|
| Desktop | >= 1024px | 240px expanded or 64px collapsed | Remaining |
| Tablet | 768-1023px | 64px collapsed by default | Remaining |
| Mobile | < 768px | Hidden; overlay drawer | Full width |

### Adaptation Rules
- Tables become card lists on mobile
- Modals become full-screen on mobile
- Sidebar becomes drawer overlay on mobile (hamburger to open)
- Drop zone uses compact variant on mobile

### Layout Components
- **Public layout**: Navbar (transparent, sticky) + full-width content + Footer
- **Authenticated layout**: Navbar (hamburger, logo, team selector, bell, avatar) + Sidebar (left) + Content (scrollable) + Status Bar

Navbar and sidebar anatomy is specified in `docs/frontend/overview.md`.

---

## Implementation Workflow

When the user asks to build a frontend feature, follow this order:

1. **Check docs** — Read the relevant page doc(s) from the Quick Reference table
2. **Check components** — See `docs/frontend/components.md` — is there already a shared component for what you need?
3. **Add route** — If it's a new page, add the route to the route file with the correct guard from `docs/frontend/routing.md`
4. **Add i18n keys** — Add any new translation keys to the relevant namespace JSON files
5. **Define types + API** — TypeScript interfaces and TanStack Query hooks for the data
6. **Define Zod schema** — If the page has a form
7. **Build the page** — Follow the Page Implementation Pattern (happy path → loading → empty → error → edge cases)
8. **Invoke `frontend-design`** — After structure is complete, apply visual styling

### Phase Awareness

- **Phase 1** (MVP): Public home page, login/signup/auth pages, dashboard (translate, translations list, translation detail), basic layout, drop zone, language selector, progress bar. Check `docs/features/feature-matrix.md` for the full Phase 1 scope.
- **Phase 2**: Batch translation, glossaries, webhooks, API keys, notifications, teams, billing/subscription, admin panel. Built on Phase 1 foundations.
- **Phase 3**: Translation memory UI, scheduling, audit logs, custom roles. Do not build unless explicitly asked.
