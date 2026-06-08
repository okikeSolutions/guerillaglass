"use client";

import { MountainSnow, Rainbow } from "lucide-react";

export const FeatureBento: React.FC = () => {
  return (
    <section className="bg-black/45 min-h-screen py-10 font-manrope">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-10 max-w-3xl text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/60">
            Problem & product
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            The product is built for teams who need better videos without a messier process.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/80">
            Guerilla Glass replaces a stitched-together stack of recorder, editor, export, and
            review apps with one timeline-first desktop workflow.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[280px]">
          {/* Hero Card - Large */}
          <div className="md:col-span-2 md:row-span-2 bg-black/20 backdrop-blur-lg rounded-3xl p-10 text-white flex flex-col justify-end relative overflow-hidden group">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200')] bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute top-0 left-0 w-full h-full bg-linear-to-t from-black/60 to-transparent" />

            <div className="relative z-10 space-y-3">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium">
                <span className="size-2 bg-green-400 rounded-full animate-pulse" />
                One workflow
              </div>
              <h3 className="text-5xl font-bold tracking-tight">
                Capture, cut,
                <br />
                review, deliver
              </h3>
              <p className="max-w-md text-white/90 text-lg">
                Record the source, shape the story on a timeline, collect feedback, and export the
                final file without leaving Guerilla Glass.
              </p>
            </div>
          </div>

          {/* Stats Card 1 */}
          <div className="bg-black/20 backdrop-blur-lg rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group transition-all">
            <div className="absolute -right-8 -top-8 size-32 bg-white/20 rounded-full blur-2xl transition-transform duration-500" />
            <div className="relative z-10">
              <div className="size-14 text-white rounded-2xl bg-blue-600 backdrop-blur-sm flex items-center justify-center text-2xl mb-4">
                <MountainSnow className="w-6 h-6" />
              </div>
              <h4 className="text-4xl font-black text-white mb-2">macOS 13+</h4>
              <p className="text-neutral-200 font-medium">
                Production-ready capture and export today
              </p>
            </div>
          </div>

          {/* Feature Card */}
          <div className="bg-black/20 backdrop-blur-lg rounded-3xl p-8 flex flex-col justify-between border border-white/10 transition-all group">
            <div className="size-12 rounded-lg bg-linear-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xl font-bold transition-transform">
              <Rainbow className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h4 className="text-2xl font-bold text-white">Local-first desktop engine</h4>
              <p className="text-neutral-200">
                Native capture and deterministic rendering keep the editing workflow responsive,
                private, and reliable even when you are offline.
              </p>
            </div>
          </div>

          {/* CTA Card */}
          <a
            href="#pricing"
            className="bg-black/20 backdrop-blur-lg rounded-3xl p-8 text-white flex flex-col justify-between transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                Buying path
              </span>
              <div className="size-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-xl group-hover:bg-white/30 group-hover:rotate-45 transition-all">
                ↗
              </div>
            </div>
            <h4 className="text-2xl font-bold leading-tight">
              Compare plans
              <br />
              and pricing
            </h4>
          </a>

          {/* Stats Card 2 */}
          <div className="bg-black/20 backdrop-blur-lg rounded-3xl p-8 text-white flex flex-col justify-center gap-3 relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-br from-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="absolute top-5 right-5 flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex size-3 rounded-full bg-blue-500"></span>
            </span>
            <div className="relative z-10">
              <span className="text-5xl font-black bg-linear-to-r from-blue-200 to-blue-600 bg-clip-text text-transparent">
                Review
              </span>
              <p className="text-sm uppercase tracking-widest text-neutral-300 font-semibold mt-2">
                Timestamped links and comments
              </p>
            </div>
          </div>

          {/* Stats Card 3 */}
          <div className="bg-black/20 backdrop-blur-lg rounded-3xl p-8 text-white flex flex-col justify-center gap-3 relative overflow-hidden group hover:shadow-2xl transition-all">
            <div className="absolute -bottom-10 -right-10 size-40 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <span className="text-5xl font-black">Export</span>
              <p className="text-sm uppercase tracking-widest text-rose-100 font-semibold mt-2">
                Deliver polished videos faster
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
