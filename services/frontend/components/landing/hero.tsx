'use client'

import { Button } from '@/components/ui/button'
import { Zap, Play } from 'lucide-react'
import Link from 'next/link'

export function Hero() {
  return (
    <div className="relative min-h-screen grid-bg overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full glow-cyan opacity-20 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full glow-purple opacity-20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-60 h-60 rounded-full glow-pink opacity-15 blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-20 lg:py-32 flex flex-col items-center justify-center min-h-screen">
        {/* Top accent badges */}
        <div className="flex gap-3 mb-8 flex-wrap justify-center">
          <div className="glass px-4 py-2 rounded-full text-sm text-cyan-400 border border-cyan-500/50 glow-cyan">
            ⚡ Now Live
          </div>
          <div className="glass px-4 py-2 rounded-full text-sm text-pink-400 border border-pink-500/50 glow-pink">
            🔥 1000+ Players
          </div>
        </div>

        {/* Main headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-balance text-center mb-6 leading-tight">
          <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent glow-text-cyan">
            Multiplayer
          </span>
          <br />
          <span className="text-white">Tic-Tac-Toe</span>
          <br />
          <span className="bg-gradient-to-r from-pink-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent glow-text-pink">
            Redefined
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-gray-300 text-center mb-12 max-w-2xl leading-relaxed">
          Lightning-fast matches. Real-time rivals. Pure strategy. Jump into intense 3-minute battles and prove you&apos;re the ultimate tic-tac-toe champion.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-black font-bold px-8 h-14 text-lg glow-cyan shadow-lg"
            asChild
          >
            <Link href="/play">
              <Zap className="w-5 h-5 mr-2" />
              Play Now
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-purple-400/50 hover:border-purple-400 hover:bg-purple-400/10 text-purple-300 font-bold px-8 h-14 text-lg glow-purple"
          >
            <Play className="w-5 h-5 mr-2" />
            Watch Demo
          </Button>
        </div>

        {/* Live game preview panel */}
        <div className="w-full max-w-2xl glass rounded-2xl p-8 glow-cyan border border-cyan-500/30 mb-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-cyan-500/20">
            <h3 className="text-cyan-300 font-bold text-lg">Live Match: AlexX vs NeonSky</h3>
            <div className="flex gap-2">
              <span className="inline-block w-2 h-2 bg-pink-400 rounded-full animate-pulse"></span>
              <span className="text-xs text-pink-400 font-semibold">2:34</span>
            </div>
          </div>

          {/* Game board */}
          <div className="grid grid-cols-3 gap-2 mb-6 bg-black/40 p-4 rounded-lg border border-purple-500/20">
            {[
              { player: 'X', accent: 'text-cyan-400' },
              { player: '', accent: '' },
              { player: 'O', accent: 'text-pink-400' },
              { player: '', accent: '' },
              { player: 'X', accent: 'text-cyan-400' },
              { player: '', accent: '' },
              { player: 'O', accent: 'text-pink-400' },
              { player: '', accent: '' },
              { player: '', accent: '' },
            ].map((cell, idx) => (
              <div
                key={idx}
                className="aspect-square glass border border-purple-500/40 rounded-lg flex items-center justify-center hover:border-purple-500/60 transition-colors cursor-pointer hover:bg-white/10"
              >
                <span className={`text-4xl font-bold ${cell.accent}`}>{cell.player}</span>
              </div>
            ))}
          </div>

          {/* Game stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-cyan-400/10 border border-cyan-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-cyan-300 mb-1">AlexX (X)</p>
              <p className="text-2xl font-bold text-cyan-400">2 points</p>
            </div>
            <div className="bg-pink-400/10 border border-pink-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-pink-300 mb-1">NeonSky (O)</p>
              <p className="text-2xl font-bold text-pink-400">1 point</p>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div>
            <p className="text-2xl font-bold text-cyan-400">1000+</p>
            <p className="text-sm text-gray-400">Active Players</p>
          </div>
          <div className="hidden sm:block w-px h-12 bg-purple-500/30"></div>
          <div>
            <p className="text-2xl font-bold text-pink-400">50ms</p>
            <p className="text-sm text-gray-400">Avg Response</p>
          </div>
          <div className="hidden sm:block w-px h-12 bg-cyan-500/30"></div>
          <div>
            <p className="text-2xl font-bold text-purple-400">99.9%</p>
            <p className="text-sm text-gray-400">Uptime</p>
          </div>
        </div>
      </div>
    </div>
  )
}
