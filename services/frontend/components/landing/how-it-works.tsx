'use client'

import { UserPlus, Swords, Trophy } from 'lucide-react'

interface StepProps {
  number: number
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

function Step({ number, icon, title, description, color }: StepProps) {
  return (
    <div className="relative">
      {/* Connector line (hidden on mobile) */}
      {number !== 3 && (
        <div className={`hidden md:block absolute top-24 -right-16 w-32 h-1 bg-gradient-to-r ${color} opacity-30`}></div>
      )}

      <div className="glass rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all h-full relative z-10">
        {/* Step number badge */}
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br ${color} mb-6 font-bold text-lg text-white shadow-lg`}>
          {number}
        </div>

        {/* Icon */}
        <div className="mb-6">
          {icon}
        </div>

        {/* Content */}
        <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

export function HowItWorks() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden grid-bg">
      {/* Background accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full glow-cyan opacity-5 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full glow-pink opacity-5 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
            How It{' '}
            <span className="bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Three simple steps to legendary competition
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          <Step
            number={1}
            icon={<UserPlus className="w-8 h-8 text-cyan-400" />}
            title="Sign Up"
            description="Create your account and claim your username. Customize your avatar and enter the arena ready to compete."
            color="from-cyan-500 to-cyan-400"
          />

          <Step
            number={2}
            icon={<Swords className="w-8 h-8 text-purple-400" />}
            title="Get Matched"
            description="Get paired with opponents at your skill level. Matchmaking is instant and fair. The battle begins immediately."
            color="from-purple-500 to-purple-400"
          />

          <Step
            number={3}
            icon={<Trophy className="w-8 h-8 text-pink-400" />}
            title="Claim Victory"
            description="Win matches to earn points and climb the global leaderboard. Every victory brings you closer to legend status."
            color="from-pink-500 to-pink-400"
          />
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <div className="inline-block glass rounded-xl px-8 py-6 border border-white/10">
            <p className="text-gray-400 mb-3">Ready to start your journey?</p>
            <button className="px-8 py-3 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-black font-bold rounded-lg glow-cyan transition-all hover:scale-105">
              Enter the Arena
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

