import { T } from "@/lib/sim/types";

export type NavItem = { key: string; label: string; href: string; icon: string; group: string; types?: string[] };

export const NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/home", icon: "Home", group: "General" },
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", group: "General" },
  { key: "services", label: "All services", href: "/services", icon: "Grid3x3", group: "General" },
  { key: "rgs", label: "Resource groups", href: "/resource-groups", icon: "Boxes", group: "General", types: [T.RG] },
  { key: "vms", label: "Virtual machines", href: "/virtual-machines", icon: "Monitor", group: "Compute", types: [T.VM] },
  { key: "storage", label: "Storage accounts", href: "/storage-accounts", icon: "Database", group: "Storage", types: [T.STORAGE] },
  { key: "vnets", label: "Virtual networks", href: "/virtual-networks", icon: "Network", group: "Networking", types: [T.VNET] },
  { key: "nsgs", label: "Network security groups", href: "/network-security-groups", icon: "ShieldCheck", group: "Networking", types: [T.NSG] },
  { key: "entra", label: "Microsoft Entra ID", href: "/entra-id", icon: "Users", group: "Identity", types: [T.ENTRA_USER, T.ENTRA_GROUP, T.ROLE_ASSIGNMENT] },
  { key: "apps", label: "App Services", href: "/app-services", icon: "Globe", group: "Web", types: [T.SITE, T.PLAN] },
  { key: "functions", label: "Function App", href: "/functions", icon: "Zap", group: "Web", types: [T.FUNCTION_APP] },
  { key: "sql", label: "Azure SQL", href: "/sql", icon: "Table2", group: "Databases", types: [T.SQL_SERVER, T.SQL_DB] },
  { key: "kv", label: "Key vaults", href: "/key-vaults", icon: "KeyRound", group: "Security", types: [T.KEYVAULT] },
  { key: "monitor", label: "Monitor", href: "/monitor", icon: "Activity", group: "Monitoring", types: [T.ALERT] },
  { key: "logs", label: "Log Analytics", href: "/log-analytics", icon: "ScrollText", group: "Monitoring", types: [T.WORKSPACE] },
  { key: "appinsights", label: "Application Insights", href: "/app-insights", icon: "LineChart", group: "Monitoring", types: [T.APPINSIGHTS] },
  { key: "devops", label: "Azure DevOps", href: "/devops", icon: "GitBranch", group: "DevOps", types: [T.DEVOPS_PROJECT] },
  { key: "containers", label: "Containers", href: "/containers", icon: "Container", group: "Containers", types: [T.ACR, T.ACI, T.AKS] },
  { key: "backup", label: "Backup center", href: "/backup", icon: "ArchiveRestore", group: "Management", types: [T.BACKUP_VAULT] },
  { key: "cost", label: "Cost Management", href: "/cost", icon: "Wallet", group: "Management", types: [T.BUDGET] },
  { key: "terminal", label: "Cloud terminal", href: "/terminal", icon: "SquareTerminal", group: "Tools" },
  { key: "learning", label: "Learning Center", href: "/learning", icon: "GraduationCap", group: "Learning" },
  { key: "labs", label: "My Labs", href: "/labs", icon: "FlaskConical", group: "Learning" },
  { key: "interview", label: "Interview Preparation", href: "/interview", icon: "MessagesSquare", group: "Learning" },
  { key: "company", label: "Contoso workplace", href: "/company", icon: "Building2", group: "Learning" },
  { key: "real", label: "Real Azure Mode", href: "/real-azure", icon: "Cloud", group: "Tools" },
];
