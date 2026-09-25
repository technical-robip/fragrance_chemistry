/** Authored icon set for the landing surface: one family, 1.5 stroke, 20px box. */

type IconProps = { size?: number };

function Frame({ size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 10.5 8 14.5 16 5.5" />
    </Frame>
  );
}

export function IconDash(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M5 10h10" />
    </Frame>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M3.5 10h13M11.5 5 16.5 10l-5 5" />
    </Frame>
  );
}

/** Flask: composition. */
export function IconFlask(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M7.5 2.5h5M8.5 2.5v4L5 14a2 2 0 0 0 1.8 3h6.4A2 2 0 0 0 15 14l-3.5-7.5v-4" />
      <path d="M6.2 11.5h7.6" />
    </Frame>
  );
}

/** Balance pan with a post: weighing. */
export function IconScale(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M10 3v9M6 17h8M10 17v-2" />
      <path d="M3.5 12h13l-2.2 3.2H5.7L3.5 12Z" />
      <path d="M6.5 6h7" />
    </Frame>
  );
}

/** Shield with a rule: compliance gate. */
export function IconShield(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M10 2.5 16 5v5.5c0 3.4-2.4 6.1-6 7-3.6-.9-6-3.6-6-7V5l6-2.5Z" />
      <path d="M7.2 9.8h5.6" />
    </Frame>
  );
}

/** Stacked coins seen edge-on: cost. */
export function IconCost(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 6.2c0-1.2 2.7-2.2 6-2.2s6 1 6 2.2-2.7 2.2-6 2.2S4 7.4 4 6.2Z" />
      <path d="M4 6.2v7.6c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V6.2" />
      <path d="M4 10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2" />
    </Frame>
  );
}

/** Clock face with a long hand: maceration timers. */
export function IconClock(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 5.8V10l3.2 2" />
    </Frame>
  );
}

/** Book lying open: the manual itself. */
export function IconManual(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M10 5.2C8.4 4 6.4 3.5 3.5 3.5v11c2.9 0 4.9.5 6.5 1.7 1.6-1.2 3.6-1.7 6.5-1.7v-11c-2.9 0-4.9.5-6.5 1.7Z" />
      <path d="M10 5.2V16.2" />
    </Frame>
  );
}
