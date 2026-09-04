"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserSessionProfile } from "@/lib/types";
import {
  Bell,
  Globe,
  GraduationCap,
  Building2,
  Shield,
  LogOut,
  User,
} from "lucide-react";
import clsx from "clsx";

interface NavbarProps {
  user: UserSessionProfile | null;
  authenticatedEmail?: string | null;
}

export function Navbar({ user, authenticatedEmail }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  const navItems = [
    {
      href: "/announcements",
      label: "Announcements",
      icon: Bell,
      active: pathname.startsWith("/announcements"),
    },
    {
      href: "/chat/all",
      label: "All College",
      icon: Globe,
      active: pathname === "/chat/all" || (pathname.startsWith("/chat/") && !pathname.includes("cohort") && !pathname.includes("alumni")),
    },
    {
      href: "/chat/cohort",
      label: user ? `${user.cohort} Batch` : "My Batch",
      icon: GraduationCap,
      active: pathname === "/chat/cohort",
      disabled: user?.role === "alumni",
    },
    {
      href: "/chat/alumni",
      label: "Alumni",
      icon: Building2,
      active: pathname === "/chat/alumni",
      disabled: user && user.role !== "alumni" && !["moderator", "admin", "super_admin"].includes(user.role),
    },
  ];

  const isStaff =
    user && ["moderator", "admin", "super_admin"].includes(user.role);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-6xl items-center justify-between px-4 mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/chat/all" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
            <span className="text-xl">Campus</span>
            <span className="rounded-full bg-accent/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border">
              NSUT
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              if (item.disabled) return null;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    item.active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

            {isStaff && (
              <Link
                href="/admin"
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <Shield className="h-4 w-4 text-amber-400" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* User Identity Banner */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-secondary/60 border border-border rounded-full pl-2 pr-3 py-1 text-xs">
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                  {user.anonymousName.slice(9, 11) || <User className="h-3 w-3" />}
                </div>
                <span className="font-semibold text-foreground truncate max-w-[120px] sm:max-w-[180px]">
                  {user.anonymousName}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  '{String(user.cohort).slice(-2)}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : authenticatedEmail ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-800/50 rounded-full pl-2.5 pr-3 py-1 text-xs text-emerald-300">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
                  {authenticatedEmail}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          if (item.disabled) return null;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center gap-0.5 py-1 px-2 rounded-md text-[11px] font-medium transition-colors",
                item.active
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate max-w-[70px]">{item.label}</span>
            </Link>
          );
        })}
        {isStaff && (
          <Link
            href="/admin"
            className={clsx(
              "flex flex-col items-center gap-0.5 py-1 px-2 rounded-md text-[11px] font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "text-amber-400 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            <span>Admin</span>
          </Link>
        )}
      </nav>
    </header>
  );
}
