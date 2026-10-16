const PATHS = {
  book: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5Z',
  cursor: 'M4 3 20 10l-7 3-3 7-6-17Z',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
  hotel: 'M3 18v4m18-4v4M3 18h18V11H3v7ZM5 11V3h14v8M8 7h2m4 0h2',
  hut: 'm3 10 9-7 9 7v11H3V10Zm6 11v-9h6v9',
  pass: 'M12 2v20M5 5h13l3 3-3 3H5l-3-3 3-3Z',
  village: 'M4 21V7h7v14M11 21V3h9v18M7 10v2m0 3v2m8-10v2m2 2v2m-2 2v2M2 21h20',
  binoculars: 'M5 5h4l1 14H2L5 5Zm10 0h4l3 14h-8l1-14ZM10 10h4M4 3h4m8 0h4',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  locate: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.3 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  zoom: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-5-5',
  chart: 'M3 20h18M5 16l4-6 4 3 6-8',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  download: 'M12 4v12m0 0-5-5m5 5 5-5M4 20h16',
  upload: 'M12 20V8m0 0-5 5m5-5 5 5M4 4h16',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4',
  check: 'm5 12 5 5 9-10',
  close: 'M6 6l12 12M18 6 6 18',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  save: 'M5 3h11l3 3v15H5V3Zm3 0v6h8V3M8 21v-7h8v7',
  file: 'M6 2h9l5 5v15H6V2Zm9 0v5h5',
  alert: 'M12 3 2 21h20L12 3Zm0 7v5m0 3v.5',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
  mountain: 'M3 20 9.5 8l4 7 2.5-4L21 20H3Z',
  folder: 'M3 6h6l2 2h10v11H3V6Z',
  info: 'M12 8v.5M12 11v6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
