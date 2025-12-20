"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function Navbar() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
                <div className="mr-4 hidden md:flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="hidden font-bold sm:inline-block">
                            TurnBased Microservices
                        </span>
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/dashboard"
                            className={cn(
                                "transition-colors hover:text-foreground/80",
                                pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"
                            )}
                        >
                            Dashboard
                        </Link>
                    </nav>
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* Search or other items could go here */}
                    </div>
                    <nav className="flex items-center space-x-2">
                        <Link href="/login">
                            <Button variant="ghost" size="sm">
                                Login
                            </Button>
                        </Link>
                        <Link href="/register">
                            <Button size="sm">
                                Register
                            </Button>
                        </Link>
                    </nav>
                </div>
            </div>
        </header>
    );
}
