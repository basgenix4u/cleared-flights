import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const make = (children: ReactNode) =>
  function Icon(p: P) {
    return (
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...p}
      >
        {children}
      </svg>
    );
  };

export const IconArrow = make(<path d="M4 12h16M14 6l6 6-6 6" />);
export const IconSwap = make(<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />);
export const IconPlane = make(<path d="M3 11.5 21 3l-8.5 18-2.2-7.8L3 11.5zM10.3 13.2 21 3" />);
export const IconCheck = make(<path d="M4 12.5l5 5L20 6.5" />);
export const IconClose = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconChevron = make(<path d="M6 9l6 6 6-6" />);
export const IconBag = make(
  <>
    <path d="M7 8h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
    <path d="M9.5 8V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V8M9 20.5v1M15 20.5v1" />
  </>,
);
export const IconCarry = make(
  <>
    <path d="M8 9h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
    <path d="M10 9V7a2 2 0 0 1 4 0v2" />
  </>,
);
export const IconRefund = make(<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" />);
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3 2" />
  </>,
);
export const IconInfo = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </>,
);
export const IconAlert = make(<path d="M12 4 2.5 20h19L12 4zM12 10v4M12 17h.01" />);
export const IconCalendar = make(<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />);
export const IconUser = make(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </>,
);
export const IconLock = make(<path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />);
export const IconMenu = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IconFilter = make(<path d="M4 6h16M7 12h10M10 18h4" />);
export const IconCompare = make(<path d="M8 4v16M16 4v16M3 9h5M16 15h5" />);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconMinus = make(<path d="M5 12h14" />);
export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </>,
);
export const IconSeat = make(<path d="M7 4h6a2 2 0 0 1 2 2v6h3v4H7zM9 20v-4" />);
export const IconDownload = make(<path d="M12 4v11M7 11l5 5 5-5M5 20h14" />);
export const IconPin = make(
  <>
    <path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.800 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>,
);
export const IconShield = make(<path d="M12 3 5 6v5.500c0 4.500 3 8 7 9.500 4-1.500 7-5 7-9.500V6l-7-3zM9 12l2.200 2.200L15.500 10" />);
export const IconPrint = make(<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z" />);
