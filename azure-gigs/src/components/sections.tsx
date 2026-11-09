"use client";
import { Badge, statusColor } from "./ui/misc";
import { ResourceList, Column } from "./resource/resource-list";
import { T } from "@/lib/sim/types";

const st = (v: string) => <Badge color={statusColor(v)}>{v}</Badge>;

const SECTIONS: Record<string, { types: string[]; title: string; columns?: Column[]; createTypes?: string[]; emptyHint?: string }> = {
  rgs: { types: [T.RG], title: "Resource groups", columns: [{ label: "Tags", get: (r) => Object.entries(r.tags ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") }], emptyHint: "Resource groups are containers for related resources. Create rg-web-dev in East US to begin." },
  vms: { types: [T.VM], title: "Virtual machines", columns: [{ label: "Status", get: (r) => st(r.properties.powerState) }, { label: "Size", get: (r) => r.properties.vmSize }, { label: "OS", get: (r) => r.properties.osType }, { label: "Health", get: (r) => st(r.health ?? "Unknown") }] },
  storage: { types: [T.STORAGE], title: "Storage accounts", columns: [{ label: "SKU", get: (r) => r.properties.sku }, { label: "Tier", get: (r) => r.properties.accessTier }, { label: "Containers", get: (r) => r.properties.containers.length }, { label: "Public access", get: (r) => (r.properties.allowBlobPublicAccess ? <Badge color="amber">Allowed</Badge> : <Badge color="green">Disabled</Badge>) }] },
  vnets: { types: [T.VNET], title: "Virtual networks", columns: [{ label: "Address space", get: (r) => r.properties.addressSpace.addressPrefixes.join(", ") }, { label: "Subnets", get: (r) => r.properties.subnets.length }, { label: "Peerings", get: (r) => r.properties.peerings.length }] },
  nsgs: { types: [T.NSG], title: "Network security groups", columns: [{ label: "Custom rules", get: (r) => r.properties.securityRules.length }] },
  apps: { types: [T.SITE, T.PLAN], title: "App Services and plans", columns: [{ label: "State", get: (r) => (r.type === T.SITE ? st(r.properties.state) : r.properties.sku) }, { label: "Runtime / OS", get: (r) => r.properties.runtime ?? r.properties.os }, { label: "Domain", get: (r) => r.properties.defaultHostName ?? "" }], createTypes: [T.PLAN, T.SITE] },
  functions: { types: [T.FUNCTION_APP], title: "Function apps", columns: [{ label: "Runtime", get: (r) => r.properties.runtime }, { label: "Functions", get: (r) => r.properties.functions.length }, { label: "State", get: (r) => st(r.properties.state) }] },
  sql: { types: [T.SQL_SERVER, T.SQL_DB], title: "SQL servers and databases", columns: [{ label: "Details", get: (r) => (r.type === T.SQL_DB ? `${r.properties.sku} on ${r.properties.serverName}` : r.properties.fullyQualifiedDomainName) }], createTypes: [T.SQL_SERVER, T.SQL_DB] },
  kv: { types: [T.KEYVAULT], title: "Key vaults", columns: [{ label: "Secrets", get: (r) => r.properties.secrets.length }, { label: "Permission model", get: (r) => (r.properties.enableRbacAuthorization ? "Azure RBAC" : "Access policies") }] },
  alerts: { types: [T.ALERT], title: "Alert rules", columns: [{ label: "Condition", get: (r) => `${r.properties.aggregation} ${r.properties.metric} ${r.properties.operator} ${r.properties.threshold}` }, { label: "Target", get: (r) => r.properties.targetName }, { label: "State", get: (r) => st(r.properties.state) }] },
  workspaces: { types: [T.WORKSPACE], title: "Log Analytics workspaces", columns: [{ label: "Retention", get: (r) => `${r.properties.retentionInDays} days` }] },
  appinsights: { types: [T.APPINSIGHTS], title: "Application Insights components", columns: [{ label: "Monitored app", get: (r) => r.properties.linkedSiteName ?? "-" }] },
  devops: { types: [T.DEVOPS_PROJECT], title: "DevOps projects", columns: [{ label: "Organization", get: (r) => r.properties.organization }, { label: "Pipelines", get: (r) => r.properties.pipelines.length }, { label: "Work items", get: (r) => r.properties.workItems.length }] },
  containers: { types: [T.ACR, T.ACI, T.AKS], title: "Container resources", columns: [{ label: "Details", get: (r) => (r.type === T.AKS ? `${r.properties.nodeCount} nodes · k8s ${r.properties.kubernetesVersion}` : r.type === T.ACR ? r.properties.loginServer : r.properties.image) }, { label: "State", get: (r) => st(r.properties.powerState ?? r.properties.state ?? r.status) }], createTypes: [T.ACR, T.ACI, T.AKS] },
  backup: { types: [T.BACKUP_VAULT], title: "Recovery Services vaults", columns: [{ label: "Protected items", get: (r) => r.properties.protectedItems.length }, { label: "Redundancy", get: (r) => r.properties.storageRedundancy }] },
  users: { types: [T.ENTRA_USER], title: "Users", columns: [{ label: "Display name", get: (r) => r.properties.displayName }, { label: "Department", get: (r) => r.properties.department }, { label: "Sign-in", get: (r) => (r.properties.accountEnabled ? <Badge color="green">Enabled</Badge> : <Badge color="red">Blocked</Badge>) }] },
  groups: { types: [T.ENTRA_GROUP], title: "Groups", columns: [{ label: "Type", get: (r) => r.properties.groupType }, { label: "Members", get: (r) => r.properties.members.length }] },
  roles: { types: [T.ROLE_ASSIGNMENT], title: "Role assignments", columns: [{ label: "Principal", get: (r) => r.properties.principalName }, { label: "Role", get: (r) => r.properties.roleDefinitionName }, { label: "Scope", get: (r) => <span className="font-mono text-xs">{r.properties.scope}</span> }] },
  budgets: { types: [T.BUDGET], title: "Budgets", columns: [{ label: "Amount", get: (r) => `$${r.properties.amount}` }, { label: "Scope", get: (r) => r.properties.resourceGroup || "Subscription" }, { label: "Thresholds", get: (r) => r.properties.thresholds.join("%, ") + "%" }] },
};

export function Section({ which, resourceGroup }: { which: keyof typeof SECTIONS | string; resourceGroup?: string }) {
  const s = SECTIONS[which];
  return <ResourceList {...s} resourceGroup={resourceGroup} />;
}
