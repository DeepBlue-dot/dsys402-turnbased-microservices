'use client'

import { Share2, Code, Tv, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 py-16 overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full glow-purple opacity-5 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent mb-4">
              TicTacThrone
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              The ultimate multiplayer tic-tac-toe platform for competitive gamers.
            </p>
          </div>

          {/* Game */}
          <div>
            <h4 className="text-white font-bold mb-4">Game</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Play Now</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Leaderboard</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Tournaments</a></li>
              <li><a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors">Replays</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">About</a></li>
              <li><a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">Blog</a></li>
              <li><a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">Careers</a></li>
              <li><a href="#" className="text-gray-400 hover:text-pink-400 transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">Privacy</a></li>
              <li><a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">Terms</a></li>
              <li><a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">Status</a></li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 py-8 flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Copyright */}
          <p className="text-sm text-gray-500">
            © 2026 TicTacThrone. All rights reserved. Made with ⚡ for champions.
          </p>

          {/* Social links */}
          <div className="flex gap-4">
            <a href="#" className="inline-flex items-center justify-center w-10 h-10 rounded-full glass border border-white/10 hover:border-cyan-400/50 hover:text-cyan-400 text-gray-400 transition-all glow-cyan">
              <Share2 className="w-5 h-5" />
            </a>
            <a href="#" className="inline-flex items-center justify-center w-10 h-10 rounded-full glass border border-white/10 hover:border-purple-400/50 hover:text-purple-400 text-gray-400 transition-all glow-purple">
              <Code className="w-5 h-5" />
            </a>
            <a href="#" className="inline-flex items-center justify-center w-10 h-10 rounded-full glass border border-white/10 hover:border-pink-400/50 hover:text-pink-400 text-gray-400 transition-all glow-pink">
              <Tv className="w-5 h-5" />
            </a>
            <a href="#" className="inline-flex items-center justify-center w-10 h-10 rounded-full glass border border-white/10 hover:border-cyan-400/50 hover:text-cyan-400 text-gray-400 transition-all">
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
