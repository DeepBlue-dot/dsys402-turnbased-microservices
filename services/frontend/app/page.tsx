import Link from "next/link";
import { LogIn, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="grid min-h-[calc(100vh-10rem)] content-center gap-8 py-8">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Tic-tac-toe command center
        </h1>
        <p className="mx-auto max-w-[700px] text-lg text-muted-foreground">
          Sign in, connect to the gateway, queue for a match, and play a live
          turn-based round through the microservice backend.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/register">
          <Button size="lg">
            <Play className="h-4 w-4" aria-hidden="true" />
            Start Playing
          </Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Login
          </Button>
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Gateway Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              The client keeps its queue and game state in step with `/ws`.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranked Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Matchmaking is driven by player presence and server-side ratings.
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Board updates render only after the game service validates turns.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
