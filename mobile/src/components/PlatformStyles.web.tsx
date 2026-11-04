import { brand } from "../theme/brand";

export function PlatformStyles() {
  return (
    <style>{`
  html, body, #root {
    background-color: ${brand.background};
    color-scheme: dark;
  }
  :where(a, button, input, textarea, select, [tabindex]):focus-visible {
    outline: 2px solid #FF6571 !important;
    outline-offset: 3px;
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
  }
 `}</style>
  );
}
