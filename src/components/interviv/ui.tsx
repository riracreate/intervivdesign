import {
  ArrowRight,
  ArrowUpRight,
  Mic,
  Code2,
  Database,
  Layers,
  BookOpen,
  Sparkles,
  Target,
  ChartNoAxesCombined,
  LayoutGrid,
  Map,
  FileText,
  Briefcase,
  GraduationCap,
  Flame,
  Search,
  Menu,
  X,
  Check,
  LogOut,
  Plus,
  Clock,
  Bookmark,
  Volume2,
  Play,
  RotateCcw,
} from "lucide-react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/interviv/workspace";
import { supabase } from "@/integrations/supabase/client";
import { companies } from "@/lib/interviv/data";
import { toast } from "sonner";
export {
  ArrowRight,
  ArrowUpRight,
  Mic,
  Code2,
  Database,
  Layers,
  BookOpen,
  Sparkles,
  Target,
  ChartNoAxesCombined,
  Flame,
  Check,
  Plus,
  Clock,
  Bookmark,
  Volume2,
  Play,
  RotateCcw,
};
export function Icon({ name }: { name: string }) {
  const icons: Record<string, typeof Mic> = {
    mic: Mic,
    code: Code2,
    database: Database,
    layers: Layers,
    book: BookOpen,
    spark: Sparkles,
    target: Target,
    chart: ChartNoAxesCombined,
  };
  const C = icons[name] ?? Sparkles;
  return <C />;
}
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <ChartNoAxesCombined />
      </span>
      <span>interViv</span>
    </Link>
  );
}
export function Heading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function Metric({
  label,
  value,
  unit,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note: string;
  icon?: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <div className="metric-value tabular-nums">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}
export function SkillBar({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="skill-line">
      <div className="row between">
        <span>{label}</span>
        <span className="text-muted tabular-nums">{note ?? `${value}%`}</span>
      </div>
      <progress max={100} value={value} />
    </div>
  );
}
const mainNav = [
  { to: "/", title: "Overview", icon: LayoutGrid },
  { to: "/practice", title: "Practice", icon: Mic },
  { to: "/progress", title: "My progress", icon: ChartNoAxesCombined },
  { to: "/roadmap", title: "My roadmap", icon: Map },
] as const;
const toolsNav = [
  { to: "/voice", title: "Voice interview", icon: Mic },
  { to: "/resume", title: "Resume extractor", icon: FileText },
  { to: "/problems", title: "Coding & SQL arena", icon: Code2 },
  { to: "/learn", title: "Spaced repetition", icon: GraduationCap },
  { to: "/gap-analysis", title: "Role gap analysis", icon: Target },
  { to: "/jobs", title: "Jobs & role match", icon: Briefcase },
  { to: "/resources", title: "Learning library", icon: BookOpen },
  { to: "/coach", title: "AI coach", icon: Sparkles },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const path = useLocation().pathname;
  const router = useRouter();
  const { user, ready } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [search, setSearch] = useState("");
  const title = [...mainNav, ...toolsNav].find((n) => n.to === path)?.title ?? "Your workspace";
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  async function signout() {
    await router.options.context.queryClient.cancelQueries();
    router.options.context.queryClient.clear();
    await supabase.auth.signOut();
    window.dispatchEvent(new Event("interviv-auth"));
    await router.navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Workspace navigation">
        <div className="row between">
          <Brand />
          {open && (
            <Button
              size="icon"
              variant="ghost"
              className="mobile-toggle"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </Button>
          )}
        </div>
        <div className="nav-label">Core workflow</div>
        <nav className="nav-list">
          {mainNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={`nav-link ${path === n.to ? "active" : ""}`}
            >
              <n.icon />
              {n.title}
            </Link>
          ))}
        </nav>
        <div className="nav-label">Readiness toolkit</div>
        <nav className="nav-list">
          {toolsNav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={`nav-link ${path === n.to ? "active" : ""}`}
            >
              <n.icon />
              {n.title}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="coach-nudge">
            <Sparkles size={18} />
            <h4>Need a clear plan?</h4>
            <p>Turn a role target or job description into a focused weekly roadmap.</p>
            <Link className="text-link" to="/coach" onClick={() => setOpen(false)}>
              Ask your coach <ArrowRight />
            </Link>
          </div>
          <div className="profile">
            <span className="avatar">
              {user
                ? String(user.user_metadata["display_name"] ?? user.email ?? "You")
                    .slice(0, 2)
                    .toUpperCase()
                : "IV"}
            </span>
            <div>
              <b>
                {user ? user.user_metadata["display_name"] || "Your workspace" : "Guest workspace"}
              </b>
              <small>{user ? "Signed in · Saved" : "No account needed to browse"}</small>
            </div>
            {user && (
              <Button
                title="Sign out"
                aria-label="Sign out"
                size="icon"
                variant="ghost"
                onClick={signout}
              >
                <LogOut size={15} />
              </Button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="row">
            <Button
              size="icon"
              variant="ghost"
              className="mobile-toggle"
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </Button>
            <div className="breadcrumb">
              Workspace <b>/ &nbsp; {title}</b>
            </div>
          </div>
          <div className="top-actions">
            <span className="demo-status">{user ? "Personal workspace" : "Browsing mode"}</span>
            <Button
              size="sm"
              variant="outline"
              className="search-trigger"
              title="Jump to any page (Ctrl+K)"
              aria-label="Search pages"
              onClick={() => setPalette(true)}
            >
              <Search size={14} />
              <span>Jump</span>
              <kbd>⌘K</kbd>
            </Button>
            {ready && !user && (
              <Button size="sm" variant="default" asChild>
                <Link to="/auth">
                  Sign in <ArrowUpRight />
                </Link>
              </Button>
            )}
          </div>
        </header>
        <main className="main-content">
          {children}
          <footer className="app-footer">
            <span>InterViv — Deterministic interview readiness & career prep</span>
            <span>Practice · Resume extractor · Coding & SQL arena</span>
          </footer>
        </main>
      </div>
      <Dialog open={palette} onOpenChange={setPalette}>
        <DialogContent>
          <DialogTitle>Jump to a workspace tool</DialogTitle>
          <input
            autoFocus
            aria-label="Search pages"
            placeholder="Type a page or feature (e.g., resume, coding, SQL, roadmap)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div>
            {[...mainNav, ...toolsNav]
              .filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
              .map((n) => (
                <Link
                  className="command-item"
                  key={n.to}
                  to={n.to}
                  onClick={() => {
                    setPalette(false);
                    setSearch("");
                  }}
                >
                  <n.icon size={18} />
                  <span style={{ flex: 1 }}>{n.title}</span>
                  <ArrowRight size={15} />
                </Link>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function TargetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (x: boolean) => void;
}) {
  const { data, update, user } = useWorkspace();
  const [company, setCompany] = useState(data.company);
  const [role, setRole] = useState(data.role);
  useEffect(() => {
    if (open) {
      setCompany(data.company);
      setRole(data.role);
    }
  }, [open, data.company, data.role]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Set your target role</DialogTitle>
        <p className="small text-muted">
          Roadmap priorities, resume gap checks, and practice defaults align to this role.
        </p>
        <div className="form-stack">
          <label>
            Company
            <select value={company} onChange={(e) => setCompany(e.target.value)}>
              {companies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {[
                "Software Engineer",
                "Backend Engineer",
                "Frontend Engineer",
                "Full-Stack Engineer",
                "Data Engineer",
                "Data Scientist",
                "ML Engineer",
                "DevOps Engineer",
                "SDE I",
                "SDE II",
                "System Engineer",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <span className="notice">
            Curated practice targets, not official hiring requirements.
          </span>
          <Button
            onClick={async () => {
              try {
                await update({ company, role });
                onOpenChange(false);
                toast.success(
                  user ? "Your target is saved." : "Target set for this visit. Sign in to save it.",
                );
              } catch {
                toast.error("Your target could not be saved.");
              }
            }}
          >
            Save target <Check />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function AuthPrompt() {
  return (
    <div className="notice row between wrap">
      <span>Sign in to save your interview sessions, extracted resume, and review schedule.</span>
      <Button variant="outline" size="sm" asChild>
        <Link to="/auth">
          Sign in <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
