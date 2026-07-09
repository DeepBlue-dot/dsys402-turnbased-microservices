'use client'

import { Zap, Flame, Shield } from 'lucide-react'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  gradient: string
  glow: string
}

function FeatureCard({ icon, title, description, gradient, glow }: FeatureCardProps) {
  return (
    <div className={`glass group rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer ${glow} hover:scale-105`}>
      {/* Icon container */}
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} mb-6 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>

      {/* Content */}
      <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>

      {/* Bottom accent line */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <p className="text-sm text-gray-500">Explore more →</p>
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background accents */}
      <div className="absolute -top-40 right-0 w-96 h-96 rounded-full glow-purple opacity-10 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 left-0 w-96 h-96 rounded-full glow-cyan opacity-10 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
            Why You&apos;ll{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Love It
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Built for competitors who demand speed, fairness, and epic moments
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-white" />}
            title="Instant Action"
            description="Jump into a match in seconds. No setup, no fuss. Real-time gameplay with zero lag means every move counts."
            gradient="from-cyan-500 to-cyan-400"
            glow="glow-cyan"
          />

          <FeatureCard
            icon={<Flame className="w-8 h-8 text-white" />}
            title="Pure Rivalry"
            description="Face opponents worldwide. Climb the leaderboards. Every victory proves you're the ultimate strategist."
            gradient="from-pink-500 to-pink-400"
            glow="glow-pink"
          />

          <FeatureCard
            icon={<Shield className="w-8 h-8 text-white" />}
            title="Fair Play"
            description="Skill-based matchmaking ensures every game is competitive. No pay-to-win. Only strategy and speed matter."
            gradient="from-purple-500 to-purple-400"
            glow="glow-purple"
          />
        </div>
      </div>
    </section>
  )
}
