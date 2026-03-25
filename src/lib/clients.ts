export const STAGES = [
  "Lead",
  "Qualification",
  "Discovery Call",
  "Follow Up",
  "Feedback",
  "Strategy Diagnosis",
  "Pitch",
  "Negotiation",
  "Contract + Advance",
  "Onboarding",
  "Strategy Phase",
  "Pre-Production",
  "Production",
  "Execution Phase",
  "Tech Deployment",
  "Optimization",
  "Reporting",
  "Review & Retention",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_COLOR: Record<string, string> = {
  "Lead":                "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  "Qualification":       "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Discovery Call":      "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  "Follow Up":           "text-sky-400 bg-sky-400/10 border-sky-400/20",
  "Feedback":            "text-cyan-300 bg-cyan-300/10 border-cyan-300/20",
  "Strategy Diagnosis":  "text-violet-400 bg-violet-400/10 border-violet-400/20",
  "Pitch":               "text-purple-400 bg-purple-400/10 border-purple-400/20",
  "Negotiation":         "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",
  "Contract + Advance":  "text-pink-400 bg-pink-400/10 border-pink-400/20",
  "Onboarding":          "text-rose-400 bg-rose-400/10 border-rose-400/20",
  "Strategy Phase":      "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "Pre-Production":      "text-amber-400 bg-amber-400/10 border-amber-400/20",
  "Production":          "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "Execution Phase":     "text-lime-400 bg-lime-400/10 border-lime-400/20",
  "Tech Deployment":     "text-green-400 bg-green-400/10 border-green-400/20",
  "Optimization":        "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  "Reporting":           "text-teal-400 bg-teal-400/10 border-teal-400/20",
  "Review & Retention":  "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
};

export const STAGE_DOT: Record<string, string> = {
  "Lead":                "bg-zinc-400",
  "Qualification":       "bg-blue-400",
  "Discovery Call":      "bg-indigo-400",
  "Follow Up":           "bg-sky-400",
  "Feedback":            "bg-cyan-300",
  "Strategy Diagnosis":  "bg-violet-400",
  "Pitch":               "bg-purple-400",
  "Negotiation":         "bg-fuchsia-400",
  "Contract + Advance":  "bg-pink-400",
  "Onboarding":          "bg-rose-400",
  "Strategy Phase":      "bg-orange-400",
  "Pre-Production":      "bg-amber-400",
  "Production":          "bg-yellow-400",
  "Execution Phase":     "bg-lime-400",
  "Tech Deployment":     "bg-green-400",
  "Optimization":        "bg-emerald-400",
  "Reporting":           "bg-teal-400",
  "Review & Retention":  "bg-cyan-400",
};

export const STAGE_SERVICES: Record<string, string[]> = {
  "Strategy Phase":     ["Brand Strategy", "Market Research", "Rebranding", "Brand Guidelines"],
  "Pre-Production":     ["360 Campaign Planning", "Content Strategy", "Website Planning", "Shoot Planning"],
  "Production":         ["Content Creation", "Shoot Production", "Packaging Design", "Offline Collaterals"],
  "Execution Phase":    ["Social Media Marketing", "Performance Marketing", "Influencer Marketing", "PR Management", "Third Party Listings", "GMB", "Reddit/Quora", "SEO/AISEO"],
  "Tech Deployment":    ["Website Development", "Landing Pages", "Tracking Setup", "Integrations"],
  "Optimization":       ["Performance Marketing Scaling", "SEO Optimization", "CRO"],
  "Reporting":          ["Analytics", "Insights", "Growth Mapping"],
  "Review & Retention": ["360 Campaigns", "Rebranding Phase 2", "Marketplace Scaling"],
};

export const INDUSTRIES = [
  "E-commerce", "D2C Brand", "Retail", "F&B", "Fashion",
  "Real Estate", "Education", "Healthcare", "SaaS", "Other",
];

export const SOURCES = [
  "Referral", "Instagram", "LinkedIn", "Cold Outreach", "Website", "Other",
];
