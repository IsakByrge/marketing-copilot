// ─────────────────────────────────────────────────────────────
// Tunna, konsekventa linjeikoner för den nya navigationen.
// Samma strokeWidth/linecap-konvention som redan används i
// campaign-builder/config.tsx, så ikonspråket känns enhetligt.
// ─────────────────────────────────────────────────────────────
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 18): SVGProps<SVGSVGElement> {
  return {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
}

export const IconToday = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
);

export const IconBuilder = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3Z" /><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" /></svg>
);

export const IconCampaigns = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M3 10v4a1 1 0 0 0 1 1h2l6 4V5L6 9H4a1 1 0 0 0-1 1Z" /><path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
);

export const IconContent = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2" /><rect x="13" y="13" width="7.5" height="7.5" rx="1.2" /></svg>
);

export const IconCompany = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M4 21V6.5L12 3l8 3.5V21" /><path d="M4 21h16M9 21v-5h6v5M9 11h.01M9 15h.01M15 11h.01M15 15h.01" /></svg>
);

export const IconHistory = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.6 1.6M8 3.5l-3 2M16 3.5l3 2" /></svg>
);

export const IconSettings = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="2.8" /><path d="M19.4 12.8a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H20a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
);

export const IconLogout = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
);

export const IconMenu = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" /></svg>
);

export const IconClose = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M5 5l14 14M19 5L5 19" /></svg>
);

export const IconArrowRight = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export const IconRisk = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M12 3.5 21.5 20h-19L12 3.5Z" /><path d="M12 10v4M12 17h.01" /></svg>
);

export const IconOpportunity = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M9 18h6M10 21h4M12 3a6.5 6.5 0 0 0-3.6 11.9c.6.4.9 1 .9 1.7v.4h5.4v-.4c0-.7.4-1.3.9-1.7A6.5 6.5 0 0 0 12 3Z" /></svg>
);

export const IconRecommendation = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M12 2.5l1.9 4.9 5.1.6-3.9 3.4 1.1 5-4.2-2.7-4.2 2.7 1.1-5-3.9-3.4 5.1-.6L12 2.5Z" /></svg>
);

export const IconChevronDown = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p}><path d="M6 9l6 6 6-6" /></svg>
);
