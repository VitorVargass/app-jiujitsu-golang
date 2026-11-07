import { useTheme } from "../theme/ThemeProvider";

export function PlatformStyles() {
  const { brand, scheme } = useTheme();
  return (
    <style>{`
  html, body, #root {
    background-color: ${brand.background};
    color-scheme: ${scheme};
  }
  :where(a, button, input, textarea, select, [tabindex]):focus-visible {
    outline: 2px solid ${brand.accentLight} !important;
    outline-offset: 3px;
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
  }
 `}</style>
  );
}
