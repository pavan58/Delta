import * as L from "lucide-react";
import type { LucideProps } from "lucide-react";

const MAP: Record<string, React.ComponentType<LucideProps>> = {
  Home: L.Home, LayoutDashboard: L.LayoutDashboard, Grid3x3: L.Grid3x3, Boxes: L.Boxes, Monitor: L.Monitor, Database: L.Database, Network: L.Network, ShieldCheck: L.ShieldCheck, Users: L.Users, Globe: L.Globe, Zap: L.Zap, Table2: L.Table2, KeyRound: L.KeyRound, Activity: L.Activity, ScrollText: L.ScrollText, LineChart: L.ChartLine, GitBranch: L.GitBranch, Container: L.Container, ArchiveRestore: L.ArchiveRestore, Wallet: L.Wallet, SquareTerminal: L.SquareTerminal, GraduationCap: L.GraduationCap, FlaskConical: L.FlaskConical, MessagesSquare: L.MessagesSquare, Building2: L.Building2, Cloud: L.Cloud,
};

export function NavIcon({ name, ...p }: { name: string } & LucideProps) {
  const C = MAP[name] ?? L.Circle;
  return <C aria-hidden {...p} />;
}
