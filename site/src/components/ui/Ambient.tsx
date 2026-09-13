/**
 * Weather behind the page: a low sun and the light off the fjord, two soft gradients that drift
 * as slowly as real light. Pure CSS on a fixed layer, composited on the GPU, no script, no blur
 * filter, and still when the visitor prefers reduced motion.
 */
export default function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="amb amb-sun" />
      <div className="amb amb-water" />
      <div className="amb amb-pine" />
      <style>{`
        .amb { position: absolute; border-radius: 50%; will-change: transform; }
        .amb-sun { width: 90vw; height: 90vw; left: -30vw; top: -45vw; background: radial-gradient(circle, rgba(226,162,59,.22) 0%, rgba(226,162,59,.09) 38%, rgba(226,162,59,0) 68%); animation: amb-a 120s ease-in-out infinite alternate; }
        .amb-water { width: 100vw; height: 100vw; right: -40vw; bottom: -50vw; background: radial-gradient(circle, rgba(111,163,194,.28) 0%, rgba(111,163,194,.12) 38%, rgba(111,163,194,0) 68%); animation: amb-b 140s ease-in-out infinite alternate; }
        .amb-pine { width: 70vw; height: 70vw; left: 30vw; bottom: -45vw; background: radial-gradient(circle, rgba(79,113,86,.14) 0%, rgba(79,113,86,0) 65%); animation: amb-a 160s ease-in-out infinite alternate-reverse; }
        @keyframes amb-a { from { transform: translate3d(0,0,0); } to { transform: translate3d(28vw, 18vh, 0); } }
        @keyframes amb-b { from { transform: translate3d(0,0,0); } to { transform: translate3d(-22vw, -16vh, 0); } }
        @media (prefers-reduced-motion: reduce) { .amb { animation: none; } }
      `}</style>
    </div>
  );
}
