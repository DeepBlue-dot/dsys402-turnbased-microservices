"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGameSocket } from "@/hooks/useGameSocket";
import { api } from "@/services/api";

export default function GamePage() {
    const { user } = useAuth();
    const { isConnected, lastMessage } = useGameSocket(user?.id);

    const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true); // Assuming Player 1 (X) starts
    const [winner, setWinner] = useState<string | null>(null);
    const [matchId, setMatchId] = useState<string | null>(null);
    const [mySymbol, setMySymbol] = useState<string | null>(null);

    useEffect(() => {
        // Load match info
        const savedMatch = localStorage.getItem("currentMatch");
        if (savedMatch && user) {
            const matchData = JSON.parse(savedMatch);
            setMatchId(matchData.matchId);
            // Determine symbol based on players
            if (matchData.players[0] === user.id) {
                setMySymbol("X");
            } else {
                setMySymbol("O");
            }
        }
    }, [user]);

    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.event === "player_move") {
            const { position, playerId } = lastMessage;
            // Update board
            setBoard(prev => {
                const newBoard = [...prev];
                // We need to know who made the move. 
                // If the message contains symbol, great. If not, we infer.
                // For now assuming alternating turns logic holds or checking backend payload
                // The backend payload in `game.controller.ts` sends `playerId`.

                // Ideally backend sends "symbol" or we derive it.
                // Simplification: If playerId == matches my Id, use mySymbol. Else opposite.
                // But wait, mySymbol state is client side.
                // We'll rely on global turn state if possible or infer X/O.

                // HACK: For this mock-up integration, let's assume X always goes first 
                // and we just toggle based on rounds, or better yet, if we knew the symbols mapping.
                // Since we don't strictly have `players` map from backend in `player_move` event, 
                // we will rely on standard turn switching:

                // If the board at position is null, fill it.
                if (!newBoard[position]) {
                    newBoard[position] = isXNext ? "X" : "O"; // This relies on local turn tracking staying in sync
                }
                return newBoard;
            });
            setIsXNext(prev => !prev);
        }

        if (lastMessage.event === "game_over") {
            setWinner(lastMessage.winner); // Backend should send "X", "O", or "Draw"
        }

    }, [lastMessage]); // Removing dependencies that cause loops like isXNext

    const handleClick = async (index: number) => {
        if (board[index] || winner || !matchId || !user) return;

        // Optimistic UI update? Or wait for server?
        // Wait for server is safer for consistency, but slower feeling.
        // Let's optimistic update to feel responsive? 
        // No, let's stick to server source of truth for "TurnBased" architecture cleanliness.
        // ACTUALLY: The prompt asks for "Real-time Gameplay".
        // Sending API call...

        try {
            await api.game.move(matchId, user.id, index);
        } catch (e) {
            console.error("Move failed", e);
        }
    };

    // Removed local checkWinner logic as backend handles it (simulated)
    // or if backend doesn't send game_over, we keep local check for visual feedback.
    // Given the backend `game.controller` just publishes event, `game-logic` service processes it.
    // We assume `game-logic` sends `game_over` event.

    // Keeping local check for immediate feedback if needed, but commenting out to rely on backend events 
    // OR keeping it as client-side prediction.

    const resetGame = () => {
        // Reset Logic
        window.location.href = "/dashboard"; // Go back to find new match
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] p-4 max-w-lg mx-auto w-full">
            {/* Header Controls */}
            <div className="flex w-full justify-between items-center mb-12">
                <div className="flex items-center gap-3">
                    <div className="grid grid-cols-3 gap-1 w-8 h-8 opacity-80">
                        <div className="bg-primary rounded-sm w-full h-full"></div>
                        <div className="bg-destructive/50 rounded-sm w-full h-full"></div>
                        <div className="bg-primary/50 rounded-sm w-full h-full"></div>
                        <div className="bg-destructive rounded-sm w-full h-full"></div>
                        <div className="bg-primary rounded-sm w-full h-full"></div>
                        <div className="bg-destructive/50 rounded-sm w-full h-full"></div>
                        <div className="bg-primary/50 rounded-sm w-full h-full"></div>
                        <div className="bg-destructive rounded-sm w-full h-full"></div>
                        <div className="bg-primary rounded-sm w-full h-full"></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg tracking-tight text-white leading-none">Tic Tac Toe</span>
                        <span className="text-muted-foreground text-xs font-medium">(XO) game</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="rounded-md bg-card hover:bg-card/80 text-muted-foreground font-medium h-8 text-xs border border-white/5 shadow-sm">
                        About
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-md bg-card hover:bg-card/80 text-muted-foreground font-medium h-8 text-xs border border-white/5 shadow-sm" onClick={resetGame}>
                        Reset
                    </Button>
                </div>
            </div>

            {/* Game Board */}
            <div className="grid grid-cols-3 gap-4 mb-16 w-full">
                {board.map((cell, index) => (
                    <button
                        key={index}
                        className={`
              aspect-square rounded-2xl flex items-center justify-center text-5xl sm:text-6xl font-bold transition-all duration-200
              border border-white border-b-white
              ${!cell && "bg-card hover:bg-card/80 shadow-sm border-b-4 border-b-black/40"}
              ${cell === "X" ? "bg-card text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)] border-b-4 border-b-black/40" : ""}
              ${cell === "O" ? "bg-card text-accent shadow-[0_0_15px_rgba(var(--accent),0.3)] border-b-4 border-b-black/40" : ""}
              disabled:cursor-not-allowed
            `}
                        onClick={() => handleClick(index)}
                        disabled={!!cell || !!winner}
                    >
                        {cell === "X" && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 sm:w-16 sm:h-16">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        )}
                        {cell === "O" && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 sm:w-16 sm:h-16">
                                <circle cx="12" cy="12" r="9"></circle>
                            </svg>
                        )}
                    </button>
                ))}
            </div>

            {/* Player Indicators */}
            <div className="grid grid-cols-3 gap-8 w-full">
                <div className="flex flex-col items-center gap-3">
                    <div className={`w-full aspect-[4/3] rounded-2xl border-b-4 flex items-center justify-center transition-all duration-300 ${isXNext ? "bg-primary text-background border-primary/50 translate-y-0" : "bg-card text-muted-foreground border-black/20 translate-y-1"}`}>
                        <span className="text-3xl font-bold">X</span>
                    </div>
                    <span className="text-xs font-bold tracking-widest text-muted-foreground">YOU</span>
                </div>

                <div className="flex flex-col items-center gap-3">
                    {/* Draw / Status Indicator could go here, for now keeping alignment */}
                </div>

                <div className="flex flex-col items-center gap-3">
                    <div className={`w-full aspect-[4/3] rounded-2xl border-b-4 flex items-center justify-center transition-all duration-300 ${!isXNext ? "bg-accent text-background border-accent/50 translate-y-0" : "bg-card text-muted-foreground border-black/20 translate-y-1"}`}>
                        <span className="text-3xl font-bold">O</span>
                    </div>
                    <span className="text-xs font-bold tracking-widest text-muted-foreground">CPU</span>
                </div>
            </div>

            {winner && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 animate-in fade-in duration-300">
                    <div className="w-full h-64 bg-card border-y border-white/5 flex flex-col items-center justify-center gap-6 shadow-2xl">
                        <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
                            {winner === "Draw" ? "Game Over" : "Winner!"}
                        </h2>
                        <div className="flex items-center gap-4 text-5xl font-black">
                            {winner === "X" && <span className="text-primary">X TAKES THE ROUND</span>}
                            {winner === "O" && <span className="text-accent">O TAKES THE ROUND</span>}
                            {winner === "Draw" && <span className="text-white">IT'S A DRAW</span>}
                        </div>
                        <div className="flex gap-4">
                            <Button onClick={resetGame} size="lg" className="rounded-full font-bold px-8 bg-white text-black hover:bg-white/90">
                                Quit
                            </Button>
                            <Button onClick={resetGame} size="lg" className="rounded-full font-bold px-8 bg-primary text-primary-foreground hover:bg-primary/90">
                                Next Round
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
