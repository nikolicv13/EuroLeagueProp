export const teamColors: Record<string, string> = {
  MAD: "#004896d0",
  BAR: "#7e0034",
  MIL: "#E3000F",
  OLY: "#c71218ad",
  PAO: "#006633",
  ULK: "#1E3A8A",
  IST: "#005B9F",
  MTA: "#003DA5",
  PAR: "#000000",
  RED: "#E3000F",
  ZAL: "#006A44",
  MUN: "#DC052D",
  VIR: "#000000",
  PAM: "#F96C18",
  BAS: "#5f0688",
  ASV: "#000000",
  HTA: "#C2203E",
  DUB: "#994a1c",
  PRS: "#000000",
  MCO: "#df0000",
};

const DEFAULT_COLOR = "#1e3a8a";

/**
 * Gets the team color based on ID or Abbreviation
 */
export function getTeamColor(teamId?: string, teamAbbr?: string): string {
  if (teamAbbr && teamColors[teamAbbr.toUpperCase()])
    return teamColors[teamAbbr.toUpperCase()];
  if (teamId && teamColors[teamId.toUpperCase()])
    return teamColors[teamId.toUpperCase()];
  return DEFAULT_COLOR;
}

export function getTeamTheme(hexColor: string) {
  // Convert Hex to RGB
  const c = hexColor.substring(1);
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;

  // Calculate brightness (luma)
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const isDark = luma < 140; // Threshold for dark vs light

  return {
    bg: hexColor,
    // If background is dark, text is white.
    text: isDark ? "#ffffff" : "#0f172a",
    // Averages box: 15% opacity of the text color (creates a lighter/darker shade of the team color)
    surface: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.10)",
    // Muted text for labels: 70% opacity
    muted: isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(15, 23, 42, 0.65)",
  };
}
