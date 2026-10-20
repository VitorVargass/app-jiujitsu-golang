import { ReactNode } from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { colors } from "../theme";

export type IconName =
  | "home"
  | "users"
  | "wallet"
  | "calendar"
  | "more"
  | "qr"
  | "check-circle"
  | "swap"
  | "plus"
  | "search"
  | "sliders"
  | "chevron-right"
  | "chevron-left"
  | "close"
  | "edit"
  | "tablet"
  | "arrow-right"
  | "mail"
  | "lock"
  | "eye"
  | "eye-off";

const glyphs: Record<IconName, ReactNode> = {
  home: (
    <>
      <Path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  users: (
    <>
      <Circle cx="9" cy="7" r="3" />
      <Path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" />
    </>
  ),
  wallet: (
    <>
      <Path d="M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V5" />
      <Path d="M21 11h-5a2 2 0 0 0 0 4h5" />
      <Circle cx="16" cy="13" r=".5" />
    </>
  ),
  calendar: (
    <>
      <Rect x="3" y="5" width="18" height="16" rx="3" />
      <Path d="M7 3v4M17 3v4M3 11h18M7 15h2M15 15h2M7 18h2" />
    </>
  ),
  more: (
    <>
      <Circle cx="5" cy="12" r="1" />
      <Circle cx="12" cy="12" r="1" />
      <Circle cx="19" cy="12" r="1" />
    </>
  ),
  qr: (
    <>
      <Rect x="3" y="3" width="6" height="6" rx="1" />
      <Rect x="15" y="3" width="6" height="6" rx="1" />
      <Rect x="3" y="15" width="6" height="6" rx="1" />
      <Path d="M15 15h3v3h3M15 21h3M21 12v3M12 3v3M3 12h3M12 12h3M12 18v3M21 21h.01" />
    </>
  ),
  "check-circle": (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="m8 12 3 3 5-6" />
    </>
  ),
  swap: (
    <>
      <Path d="M3 7h18l-4-4M21 17H3l4 4" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <Circle cx="10.5" cy="10.5" r="6.5" />
      <Path d="m16 16 5 5" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 7h5M13 7h7M4 17h11M19 17h1" />
      <Circle cx="11" cy="7" r="2" />
      <Circle cx="17" cy="17" r="2" />
    </>
  ),
  "chevron-right": <Path d="m9 5 7 7-7 7" />,
  "chevron-left": <Path d="m15 5-7 7 7 7" />,
  edit: (
    <>
      <Path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" />
      <Path d="M13 20h7" />
    </>
  ),
  tablet: (
    <>
      <Rect x="5" y="2" width="14" height="20" rx="2" />
      <Path d="M11 18h2" />
    </>
  ),
  "arrow-right": <Path d="M4 12h16m-6-6 6 6-6 6" />,
  mail: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Path d="m3 6 9 7 9-7" />
    </>
  ),
  lock: (
    <>
      <Rect x="4" y="10" width="16" height="11" rx="2" />
      <Path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
    </>
  ),
  eye: (
    <>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <Path d="M3 3 21 21M10 5a12 12 0 0 1 2 0c6.5 0 10 7 10 7a18 18 0 0 1-3 4M6 6a21 21 0 0 0-4 6s3.5 7 10 7a13 13 0 0 0 5-1M10 10a3 3 0 0 0 4 4" />
    </>
  ),
  close: <Path d="m6 6 12 12M6 18 18 6" />,
};

export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={true}>
      <G
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyphs[name]}
      </G>
    </Svg>
  );
}
