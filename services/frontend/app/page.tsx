import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] py-12 gap-8 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          TurnBased Microservices
        </h1>
        <p className="max-w-[700px] text-lg text-muted-foreground mx-auto">
          A modern, multiplayer turn-based game platform built with microservices architecture.
          Join games, challenge friends, and climb the leaderboard.
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/register">
          <Button size="lg">Get Started</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg">Login</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Microservices Architecture</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Built for scalability and reliability using a distributed system design.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Real-time Gameplay</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Experience seamless turn-based action with low latency updates.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secure & Fast</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Secure authentication and fast matchmaking for the best experience.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
