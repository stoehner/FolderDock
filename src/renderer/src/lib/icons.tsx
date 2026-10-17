import type { ReactNode } from 'react'

const shapes: Record<string, ReactNode> = {
  folder: <path d="M3 7.5V5.8A2.8 2.8 0 0 1 5.8 3h4.1l2 2.2h6.3A2.8 2.8 0 0 1 21 8v10.2a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 18.2Z" />,
  stack: (
    <>
      <path d="M5 7V4.8C5 3.8 5.8 3 6.8 3h10.4C18.2 3 19 3.8 19 4.8V7" />
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M7 12h10M7 16h7" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 5 5" />
    </>
  ),
  note: (
    <>
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M15 3v4h4M8 12h8M8 16h6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  file: (
    <>
      <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v5h4" />
      <path d="M8 13h8M8 17h6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m4 19 6-6 3 3 3-4 5 6" />
    </>
  ),
  pdf: (
    <>
      <path d="M5 3h10l4 4v14H5zM15 3v4h4" />
      <path d="M8 12h8M8 16h8" />
    </>
  ),
  star: <path d="m12 2 3.1 6.5 7.1 1-5.1 5 .9 7-6-3.4-6 3.4 1-7-5.2-5 7.1-1z" />,
  download: <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />,
  rename: <path d="m5 17-1 4 4-1L20 8l-3-3zM14 8l3 3" />,
  upload: <path d="M12 21V7m-5 5 5-5 5 5M4 3h16" />,
  move: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12h8m-3-3 3 3-3 3" />
    </>
  ),
  copy: (
    <>
      <rect x="7" y="7" width="13" height="13" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 4l1.5 1.5M18.5 18.5 20 20M2 12h2m16 0h2M4 20l1.5-1.5M18.5 5.5 20 4" />
    </>
  ),
  moon: <path d="M20 15a8 8 0 0 1-11-11A8.2 8.2 0 1 0 20 15z" />,
  x: <path d="M5 5 19 19M19 5 5 19" />,
  minus: <path d="M5 12h14" />,
  maximize: <rect x="4" y="4" width="16" height="16" rx="1" />,
  restore: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1" />
      <path d="M4 16V5a1 1 0 0 1 1-1h11" />
    </>
  ),
  grip: <path d="M9 4v16M15 4v16" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  )
}

export function ico(name: string, cls = ''): ReactNode {
  return (
    <svg className={`icon ${cls}`} viewBox="0 0 24 24" aria-hidden="true">
      {shapes[name] ?? shapes.file}
    </svg>
  )
}
