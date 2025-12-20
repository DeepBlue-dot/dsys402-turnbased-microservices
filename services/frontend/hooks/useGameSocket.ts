"use client";

import { useEffect, useRef, useState } from "react";

const GAME_SOCKET_URL = "ws://localhost:4000";

export function useGameSocket(playerId: string | undefined) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);

    // Keep reference to prevent multiple connections
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!playerId) return;
        if (wsRef.current) return; // Already connected

        console.log("Connecting to Game Socket...");
        const ws = new WebSocket(`${GAME_SOCKET_URL}?playerId=${playerId}`);

        ws.onopen = () => {
            console.log("Game Socket Connected");
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("Socket Message:", data);
                setLastMessage(data);
            } catch (e) {
                console.error("Failed to parse socket message", event.data);
            }
        };

        ws.onclose = () => {
            console.log("Game Socket Disconnected");
            setIsConnected(false);
            wsRef.current = null;
        };

        wsRef.current = ws;
        setSocket(ws);

        return () => {
            // Optional cleaning
        };
    }, [playerId]);

    return { socket, isConnected, lastMessage };
}
