/** The six sub-agents, in graph order. */
export const AGENT_NAMES = [
  "RecceAgent",
  "CompetitorMapAgent",
  "OrganicVisibilityAgent",
  "LeakageAgent",
  "ScoringAgent",
  "CopyAgent",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export const AGENT_HEADLINES: Record<AgentName, string> = {
  RecceAgent: "Reads the prospect's own site",
  CompetitorMapAgent: "Finds who they actually compete with",
  OrganicVisibilityAgent: "Estimates organic footprint, prospect vs field",
  LeakageAgent: "Where revenue leaks, on-site and to rivals",
  ScoringAgent: "ICP fit 0-100 with a transparent breakdown",
  CopyAgent: "Four touches, each tied to a named finding",
};
