import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 24, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.6c0-1.1 1.2-1.8 2.2-1.2l11 6.9c.9.6.9 1.9 0 2.5l-11 6.9c-1 .6-2.2-.1-2.2-1.2V4.6Z" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.5" y="3.5" width="4.5" height="17" rx="1.4" />
    <rect x="14" y="3.5" width="4.5" height="17" rx="1.4" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11.5 6.2c0-.9-1-1.4-1.7-.9L2.6 11c-.6.5-.6 1.4 0 1.9l7.2 5.7c.7.5 1.7 0 1.7-.9V6.2Z" />
    <path d="M21.5 6.2c0-.9-1-1.4-1.7-.9L12.6 11c-.6.5-.6 1.4 0 1.9l7.2 5.7c.7.5 1.7 0 1.7-.9V6.2Z" />
  </Icon>
);

export const ForwardIcon = (p: IconProps) => <BackIcon {...p} style={{ transform: "scaleX(-1)", ...p.style }} />;

export const PlusIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9.5 6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4.5 7.5 12l7.5 7.5" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const RestartIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4.5V9h4.5" />
  </Icon>
);

export const BookIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
    <path d="M12 6.5C10 5 7.5 4.5 3.5 4.7v13.6c4-.2 6.5.3 8.5 1.7 2-1.4 4.5-1.9 8.5-1.7V4.7C16.5 4.5 14 5 12 6.5Z" />
    <path d="M12 6.5V20" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="m5.5 12.5 4 4 9-9.5" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H17" />
  </Icon>
);
