"use client";
import { useEffect,useMemo,useState } from "react";
import { PartnerApi,resolveApiBase } from "../lib/api";
import { errorMessage } from "../lib/format";
import { AvailabilitySection } from "./sections/AvailabilitySection";
import { FinanceSection } from "./sections/FinanceSection";
import { OnboardingSection } from "./sections/OnboardingSection";
import { ProfileSection } from "./sections/ProfileSection";
import { QualificationsSection } from "./sections/QualificationsSection";
import { ServicesSection } from "./sections/ServicesSection";
import { SkillsSection } from "./sections/SkillsSection";
import { TeamSection } from "./sections/TeamSection";
import { WorkSection } from "./sections/WorkSection";
type User={email:string;full_name:string;role:string};
export type SectionKey="onboarding"|"profile"|"services"|"skills"|"team"|"availability"|"qualifications"|"work"|"finance";
export const SECTIONS:{key:SectionKey;label:string}[]=[{key:"onboarding",label:"Onboarding"},{key:"profile",label:"Company profile"},{key:"services",label:"Services"},{key:"skills",label:"Skills"},{key:"team",label:"Team"},{key:"availability",label:"Availability"},{key:"qualifications",label:"Qualifications"},{key:"work",label:"Jobs & offers"},{key:"finance",label:"Earnings & payouts"}];
export interface SectionProps{api:PartnerApi;navigate:(key:SectionKey)=>void}
function view(k:SectionKey,p:SectionProps){switch(k){case"onboarding":return <OnboardingSection {...p}/>;case"profile":return <ProfileSection {...p}/>;case"services":return <ServicesSection {...p}/>;case"skills":return <SkillsSection {...p}/>;case"team":return <TeamSection {...p}/>;case"availability":return <AvailabilitySection {...p}/>;case"qualifications":return <QualificationsSection {...p}/>;case"work":return <WorkSection {...p}/>;case"finance":return <FinanceSection/>;}}
async function me(base:string):Promise<User>{const r=await fetch(`${base}/auth/me`,{credentials:"include",cache:"no-store"});if(!r.ok)throw new Error("Authentication required");return r.json();}
async function csrf(base:string){const r=await fetch(`${base}/auth/csrf`,{credentials:"include",cache:"no-store"});if(!r.ok)throw new Error("Unable to verify browser session");return ((await r.json()) as {csrf_token:string}).csrf_token;}
export function PartnerApp(){const[user,setUser]=useState<User|null>(null);const[ready,setReady]=useState(false);const[active,setActive]=useState<SectionKey>("onboarding");const base=useMemo(()=>{try{return{url:resolveApiBase(process.env.NEXT_PUBLIC_API_BASE_URL),error:""}}catch(e){return{url:"",error:errorMessage(e)}}},[]);
useEffect(()=>{if(!base.url){setReady(true);return;}me(base.url).then(u=>{if(u.role!=="vendor_admin")throw new Error("Provider access required");setUser(u)}).catch(()=>setUser(null)).finally(()=>setReady(true));},[base.url]);
const api=useMemo(()=>base.url?new PartnerApi(base.url,{onUnauthorized:()=>setUser(null)}):null,[base.url]);if(!ready)return null;if(base.error)return <main className="portal-login"><p className="portal-error">{base.error}</p></main>;if(!user||!api)return <main className="portal-login"><section className="portal-login__card"><p className="portal-eyebrow">Provider workspace</p><h1>Partner Portal</h1><p>Sign in with your BREERO provider identity. Authentication is handled by Keycloak and tokens remain in HttpOnly cookies.</p><button type="button" onClick={()=>window.location.assign(`${base.url}/auth/keycloak/login?return_to=${encodeURIComponent(window.location.href)}`)}>Sign in with BREERO</button></section></main>;
const current=SECTIONS.find(x=>x.key===active)??SECTIONS[0];async function logout(){try{const token=await csrf(base.url);const r=await fetch(`${base.url}/auth/keycloak/logout`,{method:"POST",credentials:"include",headers:{"X-CSRF-Token":token}});if(r.ok){const b=await r.json() as {end_session_url?:string};if(b.end_session_url){window.location.assign(b.end_session_url);return;}}}finally{setUser(null);}}
return <div className="portal-shell"><aside><a className="portal-brand" href="https://breero.com">BREERO</a><p>Partner Portal</p><nav>{SECTIONS.map(x=><button key={x.key} type="button" className={x.key===active?"is-active":""} onClick={()=>setActive(x.key)}>{x.label}</button>)}</nav><button type="button" className="portal-signout" onClick={()=>void logout()}>Sign out</button></aside><main><header><div><p className="portal-eyebrow">Provider workspace</p><h1>{current.label}</h1></div><p>{user.full_name}<br/><small>{user.email}</small></p></header>{view(active,{api,navigate:setActive})}</main></div>}
