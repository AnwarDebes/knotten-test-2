/** Line icons for the portal, drawn on a 24 grid with a 1.75 stroke. Decorative: always next to a text label. */
const PATHS = {
  overview: "M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z",
  briefcase: "M3 8h18v12H3zM8 8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V8M3 13.5h18",
  house: "M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20",
  bolt: "M13 2.5 4.5 14H11l-1 7.5L19.5 10H13l1-7.5z",
  sliders: "M4 20v-6M4 10V4M12 20v-8M12 8V4M20 20v-4M20 12V4M1.5 14h5M9.5 8h5M17.5 16h5",
  share: "M6 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM18 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM18 15.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6",
  plug: "M9 2.5v5M15 2.5v5M6 7.5h12V11a6 6 0 0 1-12 0V7.5zM12 17v4.5",
  cube: "M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7L12 2.5zM3.5 7 12 11.5 20.5 7M12 11.5v10",
  board: "M3.5 3.5h17v17h-17zM8 7.5v8M12 7.5v5M16 7.5v10",
  folder: "M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11z",
  landmark: "M3 20.5h18M5 20.5v-9M9.7 20.5v-9M14.3 20.5v-9M19 20.5v-9M2.5 9 12 3.5 21.5 9H2.5z",
  flask: "M9 3h6M10 3v6.2L4.6 18.3A2 2 0 0 0 6.3 21.3h11.4a2 2 0 0 0 1.7-3L14 9.2V3M7.2 15h9.6",
  chart: "M3.5 3.5v17h17M7.5 15l4-4.5 3 3 5-6",
  users: "M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5",
  pulse: "M2.5 12h4l3-7.5 5 15 3-7.5h4",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  news: "M4 5h12.5v14H6a2 2 0 0 1-2-2V5zM16.5 9H20v8a2 2 0 0 1-2 2M7.5 9h5.5M7.5 12.5h5.5M7.5 16h3.5",
  shield: "M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6L12 3zM9 12l2.2 2.2L15.5 10",
  gear: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19.2 13.5l1.8 1.1-2 3.4-2-.7a7 7 0 0 1-2 1.2l-.4 2h-4l-.4-2a7 7 0 0 1-2-1.2l-2 .7-2-3.4 1.6-1.4a7 7 0 0 1 0-2.4L3 9.4l2-3.4 2 .7a7 7 0 0 1 2-1.2l.4-2h4l.4 2a7 7 0 0 1 2 1.2l2-.7 2 3.4-1.6 1.4a7 7 0 0 1 0 2.4z",
  user: "M12 3.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0",
  logout: "M9.5 20.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h4.5M16 16.5l4.5-4.5L16 7.5M20.5 12H9",
  external: "M14 3.5h6.5V10M10 14 20.5 3.5M19 14v5.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1H10",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  lock: "M5 11h14v9.5H5zM8 11V7.5a4 4 0 0 1 8 0V11",
  download: "M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20.5h15",
  upload: "M12 20.5V9M7 14l5-5 5 5M4.5 3.5h15",
  message: "M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 21l1.4-4.5A8.5 8.5 0 1 1 20.5 12z",
  sun: "M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 1.5v2.5M12 20v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12H4M20 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8",
  check: "M4.5 12.5 9.5 17.5 19.5 6.5",
  plus: "M12 4.5v15M4.5 12h15",
  clock: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3.5 2",
  file: "M6 2.5h8l5 5v14H6zM14 2.5v5h5",
  globe: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9S14.5 18.4 12 21M12 3C9.5 5.6 8.3 8.6 8.3 12s1.2 6.4 3.7 9",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
