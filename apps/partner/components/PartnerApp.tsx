"use client";

import { Fragment, useMemo, useState } from "react";
import { PortalApplication, PortalSessionProvider, usePortalSession } from "@breero/portal";

import { PartnerApi } from "../lib/api";
import { portalRuntime } from "../portal.config";
import { AvailabilitySection } from "./sections/AvailabilitySection";
import { FinanceSection } from "./sections/FinanceSection";
import { OnboardingSection } from "./sections/OnboardingSection";
import { ProfileSection } from "./sections/ProfileSection";
import { QualificationsSection } from "./sections/QualificationsSection";
import { ServicesSection } from "./sections/ServicesSection";
import { SkillsSection } from "./sections/SkillsSection";
import { TeamSection } from "./sections/TeamSection";
import { WorkSection } from "./sections/WorkSection";

export type SectionKey =
  | "onboarding"
  | "profile"
  | "services"
  | "skills"
  | "team"
  | "availability"
  | "qualifications"
  | "work"
  | "finance";

export const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "onboarding", label: "Onboarding" },
  { key: "profile", label: "Company profile" },
  { key: "services", label: "Services" },
  { key: "skills", label: "Skills" },
  { key: "team", label: "Team" },
  { key: "availability", label: "Availability" },
  { key: "qualifications", label: "Qualifications" },
  { key: "work", label: "Jobs & offers" },
  { key: "finance", label: "Earnings & payouts" },
];

export interface SectionProps {
  api: PartnerApi;
  navigate: (key: SectionKey) => void;
}

function renderSection(key: SectionKey, props: SectionProps) {
  switch (key) {
    case "onboarding": return <OnboardingSection {...props} />;
    case "profile": return <ProfileSection {...props} />;
    case "services": return <ServicesSection {...props} />;
    case "skills": return <SkillsSection {...props} />;
    case "team": return <TeamSection {...props} />;
    case "availability": return <AvailabilitySection {...props} />;
    case "qualifications": return <QualificationsSection {...props} />;
    case "work": return <WorkSection {...props} />;
    case "finance": return <FinanceSection />;
  }
}

function PartnerWorkspace() {
  const [active, setActive] = useState<SectionKey>("onboarding");
  const { state, request } = usePortalSession();
  const api = useMemo(() => new PartnerApi(request), [request]);
  return (
    <PortalApplication
      config={portalRuntime}
      navigation={SECTIONS.map((section) => ({ id: section.key, label: section.label }))}
      activeId={active}
      onNavigate={(id) => setActive(id as SectionKey)}
    >
      {state.status === "authenticated" && (
        <Fragment key={state.session.user.id}>
          {renderSection(active, { api, navigate: setActive })}
        </Fragment>
      )}
    </PortalApplication>
  );
}

export function PartnerApp() {
  return <PortalSessionProvider><PartnerWorkspace /></PortalSessionProvider>;
}
