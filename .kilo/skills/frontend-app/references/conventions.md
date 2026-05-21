# Frontend Conventions Reference

Reusable code patterns used across every page and component. Read this after SKILL.md before implementing any code.

## Import Convention

All imports use `@/` path alias pointing to `frontend/src/`.

```tsx
// shadcn/ui primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Shared components
import { DropZone } from "@/components/DropZone";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { CopyButton } from "@/components/CopyButton";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageUsageMeter } from "@/components/PageUsageMeter";
import { LanguageSelector } from "@/components/LanguageSelector";
import { SearchInput } from "@/components/SearchInput";
import { Toggle } from "@/components/Toggle";

// Contexts
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useTeam } from "@/contexts/TeamContext";

// i18n
import { useTranslation } from "react-i18next";

// Forms
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Server state
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Routing
import { useNavigate, useParams, useSearchParams, Link, Outlet } from "react-router-dom";

// Icons
import { Bell, Home, Settings, Users, Globe, Sun, Moon, LogOut, ChevronDown, Copy, Check } from "lucide-react";

// Toast
import { toast } from "sonner";
```

## Auth Context Pattern

```tsx
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/auth";
import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  role: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isVerified: false,
    role: null,
    isLoading: true,
  });
  const refreshTimerRef = useRef<ReturnType<typeof setInterval>>();
  const queryClient = useQueryClient();

  const applyAuth = useCallback((user: User, accessToken: string) => {
    setState({
      user,
      accessToken,
      isAuthenticated: true,
      isVerified: user.email_verified,
      role: user.role,
      isLoading: false,
    });
  }, []);

  const clearAuth = useCallback(() => {
    setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isVerified: false,
      role: null,
      isLoading: false,
    });
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const { access_token, user } = await authApi.refresh();
      applyAuth(user, access_token);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }, [applyAuth, clearAuth]);

  // Attempt initial refresh on mount
  useEffect(() => {
    refreshToken().finally(() => setState(s => ({ ...s, isLoading: false })));
  }, []);

  // Proactive silent refresh at 12 minutes
  useEffect(() => {
    if (!state.accessToken) return;
    refreshTimerRef.current = setInterval(refreshToken, 12 * 60 * 1000);
    return () => clearInterval(refreshTimerRef.current);
  }, [state.accessToken, refreshToken]);

  const login = async (email: string, password: string) => {
    const { user, access_token } = await authApi.login(email, password);
    applyAuth(user, access_token);
  };

  const signup = async (data: SignupData) => {
    const { user, access_token } = await authApi.signup(data);
    applyAuth(user, access_token);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    queryClient.clear();
    toast.success("Logged out successfully");
  };

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, refreshToken, setUser: (u) => applyAuth(u, state.accessToken!) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

## API Layer Pattern

```tsx
// api/client.ts
import { useAuth } from "@/contexts/AuthContext";

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any[]) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken(); // injected or from a module-level store
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`/api/v1${path}`, { ...options, headers });

  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) return request<T>(path, options);
    throw new ApiError(401, "unauthenticated", "Session expired");
  }

  const body = await response.json();

  if (!response.ok) {
    const err = body.error || { code: "unknown", message: "An error occurred" };
    throw new ApiError(response.status, err.code, err.message, err.details);
  }

  return body;
}

// api/auth.ts
export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: User; access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signup: (data: SignupData) =>
    request<{ user: User; access_token: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  refresh: () =>
    request<{ access_token: string; user: User }>("/auth/refresh", { method: "POST" }),
  logout: () =>
    request<void>("/auth/logout", { method: "POST" }),
};

// api/jobs.ts
export const jobsApi = {
  list: (params: { page?: number; per_page?: number; status?: string; search?: string }) =>
    request<JobListResponse>(`/jobs?${new URLSearchParams(params as any)}`),
  get: (jobId: string) =>
    request<{ data: Job }>(`/jobs/${jobId}`),
  submit: (formData: FormData) =>
    request<{ data: SubmitResponse }>("/documents/submit", {
      method: "POST",
      headers: {}, // Let browser set multipart boundary
      body: formData,
    }),
  cancel: (jobId: string) =>
    request<void>(`/jobs/${jobId}/cancel`, { method: "POST" }),
  delete: (jobId: string) =>
    request<void>(`/jobs/${jobId}`, { method: "DELETE" }),
  download: (jobId: string) =>
    request<{ download_url: string }>(`/jobs/${jobId}/download`, { method: "POST" }),
};
```

## TanStack Query Hook Patterns

```tsx
// hooks/useJobs.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/api/jobs";

// List with filters — uses keepPreviousData for smooth pagination
export function useJobs(filters: JobFilters) {
  return useQuery({
    queryKey: ["jobs", "list", filters],
    queryFn: () => jobsApi.list(filters),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

// Single resource
export function useJob(jobId: string) {
  return useQuery({
    queryKey: ["jobs", jobId],
    queryFn: () => jobsApi.get(jobId),
    staleTime: 5 * 60_000,
    enabled: !!jobId,
  });
}

// Mutation — invalidates relevant queries
export function useSubmitJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => jobsApi.submit(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "list"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });
}

// Optimistic delete
export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => jobsApi.delete(jobId),
    onMutate: async (jobId) => {
      await queryClient.cancelQueries({ queryKey: ["jobs", "list"] });
      const previous = queryClient.getQueryData(["jobs", "list"]);
      queryClient.setQueryData(["jobs", "list"], (old: any) => ({
        ...old,
        data: old.data.filter((j: any) => j.id !== jobId),
      }));
      return { previous };
    },
    onError: (_err, _jobId, context) => {
      queryClient.setQueryData(["jobs", "list"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "list"] });
    },
  });
}
```

## Route Guard Implementations

```tsx
// components/guards/AuthenticatedGuard.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

export function AuthenticatedGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingSkeleton variant="detail" />;
  if (!isAuthenticated) return <Navigate to={`/login?redirect=${location.pathname}`} replace />;
  return <Outlet />;
}
```

```tsx
// components/guards/GuestOnlyGuard.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

export function GuestOnlyGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSkeleton variant="detail" />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
```

```tsx
// components/guards/AdminGuard.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function AdminGuard() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSkeleton variant="detail" />;
  if (role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
```

```tsx
// components/guards/PlanGate.tsx
interface PlanGateProps {
  feature: "batch" | "glossary" | "webhook" | "api";
  children: React.ReactNode;
}

export function PlanGate({ feature, children }: PlanGateProps) {
  const { user } = useAuth();
  const hasFeature = user?.plan?.features?.[feature] ?? false;
  if (!hasFeature) return <UpgradePrompt feature={feature} />;
  return <>{children}</>;
}

function UpgradePrompt({ feature }: { feature: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{feature} requires a paid plan</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Upgrade to Pro or Enterprise to unlock {feature}.</p>
        <Button asChild>
          <Link to="/pricing">View Plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

## Form Pattern (Complete)

```tsx
// pages/Login.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: LoginFormData) => login(data.email, data.password),
    onSuccess: () => {
      toast.success(t("login.success"));
      navigate(redirectTo, { replace: true });
    },
    onError: (error: ApiError) => {
      toast.error(error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("login.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div>
            <Input {...register("email")} type="email" placeholder={t("login.email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <Input {...register("password")} type="password" placeholder={t("login.password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>
        <p>{t("login.noAccount")} <Link to="/signup">{t("login.signUp")}</Link></p>
        <p><Link to="/forgot-password">{t("login.forgotPassword")}</Link></p>
      </CardContent>
    </Card>
  );
}
```

## DataTable Pattern

```tsx
// pages/TranslationHistory.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { useJobs } from "@/hooks/useJobs";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<Job>[] = [
  {
    accessorKey: "original_filename",
    header: "File",
    cell: ({ row }) => (
      <button onClick={() => navigate(`/dashboard/translations/${row.original.id}`)}>
        {row.original.original_filename}
      </button>
    ),
  },
  {
    accessorKey: "pages_consumed",
    header: "Pages",
  },
  {
    accessorKey: "source_lang",
    header: "From → To",
    cell: ({ row }) => `${row.original.source_lang} → ${row.original.target_lang}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "created_at",
    header: "Date",
    cell: ({ row }) => formatRelativeDate(row.original.created_at),
  },
];

export default function TranslationHistory() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useJobs({ page, search, status });

  if (isLoading) return <LoadingSkeleton variant="table" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!data?.data.length) {
    return (
      <>
        <SearchInput value={search} onChange={setSearch} />
        <EmptyState
          icon={FileText}
          title={t("translations.emptyTitle")}
          description={t("translations.emptyDescription")}
          action={{ label: t("translations.translateFirst"), onClick: () => navigate("/dashboard/translate") }}
        />
      </>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data.data}
      pagination={{
        page: data.meta.page,
        perPage: data.meta.per_page,
        total: data.meta.total,
        onPageChange: setPage,
      }}
      search={<SearchInput value={search} onChange={setSearch} />}
    />
  );
}
```

## SSE Hook (Translation Progress)

```tsx
// hooks/useJobStream.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface StreamState {
  status: string | null;
  progressPct: number;
  currentStage: string | null;
  error: string | null;
  downloadUrl: string | null;
}

export function useJobStream(jobId: string) {
  const { accessToken } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [state, setState] = useState<StreamState>({
    status: null,
    progressPct: 0,
    currentStage: null,
    error: null,
    downloadUrl: null,
  });

  const connect = useCallback(() => {
    if (!accessToken) return;
    const url = `/api/v1/jobs/${jobId}/stream?token=${accessToken}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      setState({
        status: data.status,
        progressPct: data.progress_pct ?? 0,
        currentStage: data.current_stage ?? null,
        error: null,
        downloadUrl: data.download_url ?? null,
      });
      retryCountRef.current = 0;
    });

    es.addEventListener("error", (event) => {
      const data = event.data ? JSON.parse(event.data) : null;
      if (data?.status === "failed") {
        setState(s => ({ ...s, status: "failed", error: data.error }));
      }
      es.close();
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
      retryCountRef.current++;
      retryTimerRef.current = setTimeout(connect, delay);
    });
  }, [jobId, accessToken]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      clearTimeout(retryTimerRef.current);
    };
  }, [connect]);

  return state;
}
```

## Page Layout Patterns

### Authenticated Page Shell
```tsx
// components/Layouts/AuthenticatedLayout.tsx
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/contexts/AuthContext";

export function AuthenticatedLayout() {
  const { isVerified } = useAuth();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        {!isVerified && <UnverifiedBanner />}
        <main className="flex-1 overflow-y-auto p-6">
          <Breadcrumb />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### Public Page Shell
```tsx
// components/Layouts/PublicLayout.tsx
import { Outlet } from "react-router-dom";
import { PublicNavbar } from "./PublicNavbar";

export function PublicLayout() {
  return (
    <div className="min-h-screen">
      <PublicNavbar />
      <Outlet />
      <Footer />
    </div>
  );
}
```

## Toast Usage Rules

```tsx
import { toast } from "sonner";

// Success — auto-dismiss after 5s
toast.success("Translation completed!");

// Error — manual dismiss only
toast.error("Failed to submit translation");

// Warning — auto-dismiss after 8s
toast.warning("You are approaching your page limit");

// Info — auto-dismiss after 5s
toast.info("Your plan has been upgraded");

// Loading — resolves when promise settles
toast.promise(submitMutation.mutateAsync(formData), {
  loading: "Submitting translation...",
  success: "Translation submitted!",
  error: "Failed to submit",
});

// After redirect — show on the target page
// In login success handler:
navigate("/dashboard");
setTimeout(() => toast.success("Welcome back, John!"), 100);
```

## i18n Namespace JSON Pattern

```json
// public/locales/en/dashboard.json
{
  "translate": {
    "title": "New Translation",
    "dropZone": "Drop your document here",
    "sourceLang": "Source language",
    "targetLang": "Target language",
    "autoDetect": "Auto-detect",
    "swapLanguages": "Swap languages",
    "glossary": "Glossary (optional)",
    "submit": "Translate",
    "submitting": "Translating...",
    "cost": "This translation will use {{pages}} pages"
  },
  "translations": {
    "title": "Translation History",
    "emptyTitle": "No translations yet",
    "emptyDescription": "Start by translating your first document.",
    "translateFirst": "Translate a Document"
  }
}
```

Used as: `t("dashboard:translate.title")` or with the hook `const { t } = useTranslation("dashboard")` → `t("translate.title")`.

## File Upload Pattern

```tsx
// Inside a translation page
const [file, setFile] = useState<File | null>(null);
const [sourceLang, setSourceLang] = useState("auto");
const [targetLang, setTargetLang] = useState("es");

const submitMutation = useMutation({
  mutationFn: () => {
    const formData = new FormData();
    formData.append("file", file!);
    formData.append("source_lang", sourceLang);
    formData.append("target_lang", targetLang);
    return jobsApi.submit(formData);
  },
  onSuccess: (data) => {
    navigate(`/dashboard/translations/${data.job_id}`);
  },
});

return (
  <>
    <DropZone
      onFilesSelected={(files) => setFile(files[0])}
      acceptedFormats={["docx", "pptx", "xlsx", "html", "txt", "md", "yaml", "srt"]}
      maxSizeMB={10}
      multiple={false}
    />
    {file && (
      <FilePreview
        file={file}
        onRemove={() => setFile(null)}
      />
    )}
    <LanguageSelector value={sourceLang} onChange={setSourceLang} showAutoDetect />
    <LanguageSelector value={targetLang} onChange={setTargetLang} />
    <Button
      onClick={() => submitMutation.mutate()}
      disabled={!file || !targetLang || submitMutation.isPending}
    >
      {submitMutation.isPending ? "Translating..." : "Translate"}
    </Button>
  </>
);
```

## Phase 1 Starter Checklist

When building the frontend from scratch, create these in order:

1. Project scaffold with Vite + React + TypeScript + TailwindCSS
2. `src/contexts/AuthContext.tsx` — auth state + token refresh logic
3. `src/api/client.ts` — fetch wrapper with 401 interceptor + error parsing
4. `src/api/auth.ts` — login, signup, refresh, logout endpoints
5. `src/components/guards/` — AuthenticatedGuard, GuestOnlyGuard, AdminGuard, PlanGate
6. `src/components/Layouts/` — PublicLayout, AuthenticatedLayout
7. `src/routes.tsx` — all Phase 1 routes from `docs/frontend/routing.md`
8. `public/locales/en/` — common.json, home.json, auth.json, dashboard.json
9. Shared components: `DropZone`, `LanguageSelector`, `ProgressBar`, `StatusBadge`, `LoadingSkeleton`, `EmptyState`, `ErrorState`, `Breadcrumb`
10. Public pages: `PublicHome`, `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Pricing`
11. Dashboard pages: `DashboardHome`, `NewTranslation`, `TranslationHistory`, `TranslationDetail`
12. `src/hooks/useJobStream.ts` — SSE hook for real-time progress
13. Invoke `frontend-design` skill for visual polish on each page
