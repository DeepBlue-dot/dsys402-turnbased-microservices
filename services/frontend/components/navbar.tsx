"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Swords, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
    const pathname = usePathname();
    const { isAuthenticated, logout, user } = useAuth();

    const navItems = [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/matchmaking", label: "Queue" },
        { href: "/game", label: "Game" },
        { href: "/history", label: "History" },
        { href: "/users", label: "Players" },
        { href: "/settings", label: "Settings" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
                <div className="mr-4 flex min-w-0 items-center">
                    <Link href="/" className="mr-4 flex items-center gap-2 font-bold">
                        <Swords className="h-5 w-5 text-primary" aria-hidden="true" />
                        <span className="truncate">TurnBased</span>
                    </Link>
                    {isAuthenticated && (
                        <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "transition-colors hover:text-foreground/80",
                                        pathname === item.href ? "text-foreground" : "text-muted-foreground",
                                    )}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    )}
                </div>
                <div className="flex flex-1 items-center justify-end gap-2">
                    {isAuthenticated ? (
                        <>
                            <span className="hidden max-w-36 truncate text-sm text-muted-foreground sm:block">
                                {user?.username}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => void logout()} title="Log out">
                                <LogOut className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Log out</span>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Link href="/login">
                                <Button variant="ghost" size="sm">
                                    Login
                                </Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm">
                                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                                    Register
                                </Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
