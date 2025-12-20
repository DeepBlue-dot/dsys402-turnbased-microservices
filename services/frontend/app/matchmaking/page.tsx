"use client";
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";

export default function MatchmakingPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [status, setStatus] = useState<"searching" | "found">("searching");
    const [opponent, setOpponent] = useState<any>(null);
    const [matchId, setMatchId] = useState<string | null>(null);

    // Connect to socket to receive match updates
    const { isConnected, lastMessage } = useGameSocket(user?.id);

    useEffect(() => {
        if (!user?.id) return;

        // Start matchmaking when user ID is available
        const searchMatch = async () => {
            try {
                await api.matchmaking.join(user.id);
            } catch (err) {
                console.error("Failed to join matchmaking", err);
            }
        };

        // Only join if we are not already found
        if (status === "searching" && isConnected) {
            searchMatch();
        }

    }, [user?.id, isConnected, status]);

    useEffect(() => {
        if (lastMessage && lastMessage.event === "match_found") {
            setOpponent({
                username: "Opponent", // The backend event might need to send this, currently assuming structure
                rank: "Unknown",
                winRate: "Unknown"
            });
            setMatchId(lastMessage.matchId);
            setStatus("found");

            // Store match info for the game page to use
            localStorage.setItem("currentMatch", JSON.stringify(lastMessage));
        }
    }, [lastMessage]);

    const handleStartGame = () => {
        // Navigate to the game board
        router.push("/game");
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] space-y-8 p-4">

            {status === "searching" && (
                <Card className="w-full max-w-md border-none bg-transparent shadow-none text-center">
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl">🔍</span>
                            </div>
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold animate-pulse">Scanning Network...</CardTitle>
                    <CardDescription className="text-lg mt-2">
                        Searching for an opponent with similar capacity...
                    </CardDescription>
                </Card>
            )}

            {status === "found" && opponent && (
                <Card className="w-full max-w-md animate-in fade-in zoom-in duration-500 border-primary">
                    <CardHeader className="text-center bg-primary/10 rounded-t-xl">
                        <CardTitle className="text-green-500 uppercase tracking-widest text-xl">Match Found!</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 text-center space-y-4">
                        <div className="avatar w-20 h-20 rounded-full bg-secondary mx-auto flex items-center justify-center text-3xl font-bold text-secondary-foreground">
                            {opponent.username.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold">{opponent.username}</h2>
                            <p className="text-muted-foreground">{opponent.rank}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase">Win Rate</p>
                                <p className="font-bold">{opponent.winRate}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase">Status</p>
                                <p className="font-bold text-green-600">Online</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button size="lg" className="w-full font-bold text-lg h-12" onClick={handleStartGame}>
                            PLAY MATCH
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
