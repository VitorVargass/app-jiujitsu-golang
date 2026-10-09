import React from "react";
import AcademyScreen from "../academy/AcademyScreen";
import StudentsScreen from "../students/StudentsScreen";
import FinanceScreen from "../finance/FinanceScreen";
import ClassesScreen from "../classes/ClassesScreen";
import MoreScreen from "../academy/MoreScreen";
import StudentScreen, { QRScreen } from "../student/StudentScreen";
import HistoryScreen from "../attendance/HistoryScreen";
import { SectionPagesContext, SectionPages } from "./SectionPagesContext";

const screens: SectionPages = {
  "/academy": AcademyScreen,
  "/students": StudentsScreen,
  "/finance": FinanceScreen,
  "/classes": ClassesScreen,
  "/more": MoreScreen,
  "/student": StudentScreen,
  "/history": HistoryScreen,
  "/qr": QRScreen,
};

export function SectionPagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionPagesContext.Provider value={screens}>
      {children}
    </SectionPagesContext.Provider>
  );
}
