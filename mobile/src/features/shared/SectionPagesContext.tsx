import React, { createContext, useContext } from "react";

export type SectionPages = Readonly<Record<string, React.ComponentType>>;
export const SectionPagesContext = createContext<SectionPages>({});
const PreviewContext = createContext(false);
export const useSectionPages = () => useContext(SectionPagesContext);
export const useSectionPreview = () => useContext(PreviewContext);

export function SectionPreview({
  screen: Screen,
}: {
  screen: React.ComponentType;
}) {
  return (
    <PreviewContext.Provider value>
      <Screen />
    </PreviewContext.Provider>
  );
}
