"use client"

import { Type, Sparkles, Play } from "lucide-react"

/**
 * A small, looping cartoon-style animation for the hero:
 * a "text" chip (T) runs in from the left and a "picture" chip runs in from
 * the right; they hop toward the center, merge with a sparkle burst, and a
 * finished video card pops out. The loop then restarts.
 *
 * Pure CSS keyframes (defined in globals.css) — no animation library, and it
 * respects prefers-reduced-motion.
 */
export function HeroIdeaAnimation() {
  return (
    <div className="mx-auto mt-2 flex flex-col items-center" aria-hidden="true">
      <div className="relative flex h-20 w-56 items-center justify-center">
        {/* Text chip — runs in from the left */}
        <div
          className="hero-anim-loop absolute left-1/2 top-1/2 -ml-3 -mt-4"
          style={{ animationName: "heroRunT" }}
        >
          <div className="hero-anim-loop" style={{ animationName: "heroHop", animationDuration: "0.6s" }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/40 bg-accent/15 shadow-lg shadow-accent/10">
              <Type className="h-5 w-5 text-accent" />
            </div>
          </div>
        </div>

        {/* Picture chip — chases in from the right */}
        <div
          className="hero-anim-loop absolute left-1/2 top-1/2 -ml-3 -mt-4"
          style={{ animationName: "heroRunPic" }}
        >
          <div className="hero-anim-loop" style={{ animationName: "heroHop", animationDuration: "0.5s" }}>
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/20">
              <img
                src="/hero-anim-photo.png"
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* Sparkle burst at the merge point */}
        <div
          className="hero-anim-loop absolute left-1/2 top-1/2 -ml-2.5 -mt-2.5"
          style={{ animationName: "heroSparkle" }}
        >
          <Sparkles className="h-5 w-5 text-accent" />
        </div>

        {/* Finished video card — pops out when the chips merge */}
        <div
          className="hero-anim-loop absolute left-1/2 top-1/2 -ml-9 -mt-7"
          style={{ animationName: "heroVideoPop" }}
        >
          <div className="relative flex h-14 w-[72px] items-center justify-center overflow-hidden rounded-xl border border-accent/40 shadow-xl shadow-accent/15">
            <img
              src="/hero-anim-video.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-black/25" />
            <div
              className="hero-anim-loop relative flex h-7 w-7 items-center justify-center rounded-full bg-accent/90"
              style={{ animationName: "heroPlayPulse" }}
            >
              <Play className="h-3.5 w-3.5 fill-accent-foreground text-accent-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
