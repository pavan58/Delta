import { T } from "@/lib/sim/types";
import { REGIONS, STORAGE_SKUS, APP_RUNTIMES, PLAN_SKUS, SQL_SKUS, VM_SIZES } from "@/lib/sim/catalog";

export type FieldSpec = {
  name: string;
  label: string;
  kind: "text" | "number" | "select" | "checkbox" | "tags" | "rg" | "location" | "resource" | "textarea" | "list" | "password";
  options?: { value: string; label: string }[];
  resourceType?: string;
  default?: unknown;
  help?: string;
  required?: boolean;
  placeholder?: string;
};

const opt = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
export const LOCATION_OPTIONS = REGIONS.map((r) => ({ value: r.name, label: `${r.displayName} (${r.name})` }));

const base = (nameHelp: string): FieldSpec[] => [
  { name: "resourceGroup", label: "Resource group", kind: "rg", required: true },
  { name: "name", label: "Name", kind: "text", required: true, help: nameHelp },
  { name: "location", label: "Region", kind: "location", help: "Defaults to the resource group's region." },
];

export const CREATE_FORMS: Record<string, { title: string; fields: FieldSpec[] }> = {
  [T.RG]: { title: "Create a resource group", fields: [{ name: "name", label: "Resource group name", kind: "text", required: true, placeholder: "rg-web-dev", help: "Convention: rg-<workload>-<env>" }, { name: "location", label: "Region", kind: "location", required: true, default: "eastus" }, { name: "tags", label: "Tags", kind: "tags", help: "key=value, comma separated (e.g. env=dev, owner=you)" }] },
  [T.STORAGE]: { title: "Create a storage account", fields: [...base("3-24 lowercase letters and digits, globally unique"), { name: "sku", label: "Redundancy (SKU)", kind: "select", options: opt(STORAGE_SKUS), default: "Standard_LRS" }, { name: "kind", label: "Account kind", kind: "select", options: opt(["StorageV2", "BlobStorage", "BlockBlobStorage", "FileStorage"]), default: "StorageV2" }, { name: "accessTier", label: "Access tier", kind: "select", options: opt(["Hot", "Cool", "Cold"]), default: "Hot" }, { name: "minimumTlsVersion", label: "Minimum TLS version", kind: "select", options: opt(["TLS1_2", "TLS1_1", "TLS1_0"]), default: "TLS1_2" }, { name: "allowBlobPublicAccess", label: "Allow Blob anonymous access", kind: "checkbox", default: false }, { name: "httpsOnly", label: "Require secure transfer (HTTPS)", kind: "checkbox", default: true }, { name: "tags", label: "Tags", kind: "tags" }] },
  [T.VNET]: { title: "Create a virtual network", fields: [...base("e.g. vnet-contoso"), { name: "addressPrefixes", label: "IPv4 address space", kind: "list", default: "10.0.0.0/16", required: true, help: "Comma separated CIDR blocks" }, { name: "subnetName", label: "First subnet name", kind: "text", default: "default" }, { name: "subnetPrefix", label: "First subnet range", kind: "text", default: "10.0.0.0/24" }, { name: "tags", label: "Tags", kind: "tags" }] },
  [T.NSG]: { title: "Create a network security group", fields: [...base("e.g. nsg-web"), { name: "tags", label: "Tags", kind: "tags" }] },
  [T.ENTRA_USER]: { title: "New user", fields: [{ name: "displayName", label: "Display name", kind: "text", required: true }, { name: "mailNickname", label: "User name", kind: "text", required: true, help: "UPN becomes <name>@contoso.sim.azuregigs.local" }, { name: "department", label: "Department", kind: "text" }, { name: "jobTitle", label: "Job title", kind: "text" }, { name: "password", label: "Initial password", kind: "password", help: "Simulated: never stored." }, { name: "accountEnabled", label: "Account enabled", kind: "checkbox", default: true }] },
  [T.ENTRA_GROUP]: { title: "New group", fields: [{ name: "name", label: "Group name", kind: "text", required: true }, { name: "description", label: "Description", kind: "text" }, { name: "groupType", label: "Group type", kind: "select", options: opt(["Security", "Microsoft 365"]), default: "Security" }] },
  [T.ROLE_ASSIGNMENT]: { title: "Add role assignment", fields: [{ name: "role", label: "Role", kind: "select", required: true, options: opt(["Owner", "Contributor", "Reader", "User Access Administrator", "Virtual Machine Contributor", "Network Contributor", "Storage Account Contributor", "Storage Blob Data Reader", "Storage Blob Data Contributor", "Key Vault Administrator", "Key Vault Secrets User", "Key Vault Secrets Officer", "Website Contributor", "SQL DB Contributor", "AcrPull", "AcrPush", "Azure Kubernetes Service Cluster User Role", "Monitoring Reader", "Backup Operator"]) }, { name: "principal", label: "Assign access to", kind: "text", required: true, help: "User name (e.g. sneha.kulkarni), group name, or managed identity" }, { name: "scope", label: "Scope", kind: "text", required: true, default: "/", help: "/ (subscription), /resourceGroups/<rg>, or /resourceGroups/<rg>/providers/<type>/<name>" }] },
  [T.PLAN]: { title: "Create App Service plan", fields: [...base("e.g. plan-contoso"), { name: "os", label: "Operating system", kind: "select", options: opt(["Linux", "Windows"]), default: "Linux" }, { name: "sku", label: "Pricing tier", kind: "select", options: PLAN_SKUS.map((p) => ({ value: p.name, label: `${p.name} (${p.tier}) ~$${p.monthly}/mo` })), default: "B1" }] },
  [T.SITE]: { title: "Create Web App", fields: [{ name: "resourceGroup", label: "Resource group", kind: "rg", required: true }, { name: "name", label: "Name", kind: "text", required: true, help: "Becomes <name>.sim-apps.azuregigs.local" }, { name: "planName", label: "App Service plan", kind: "resource", resourceType: T.PLAN, required: true }, { name: "runtime", label: "Runtime stack", kind: "select", options: opt(APP_RUNTIMES), default: "NODE|20-lts" }, { name: "httpsOnly", label: "HTTPS only", kind: "checkbox", default: true }, { name: "identity", label: "System-assigned managed identity", kind: "checkbox", default: false }] },
  [T.FUNCTION_APP]: { title: "Create Function App", fields: [...base("Globally unique"), { name: "runtime", label: "Runtime", kind: "select", options: opt(["node", "python", "dotnet-isolated", "java", "powershell"]), default: "node" }, { name: "storageAccount", label: "Storage account", kind: "resource", resourceType: T.STORAGE, required: true }, { name: "plan", label: "Hosting plan", kind: "select", options: opt(["Consumption", "FlexConsumption", "Premium"]), default: "Consumption" }] },
  [T.SQL_SERVER]: { title: "Create SQL server", fields: [...base("lowercase, digits, hyphens"), { name: "adminLogin", label: "Server admin login", kind: "text", required: true }, { name: "adminPassword", label: "Password", kind: "password", required: true, help: "Validated for complexity; never stored." }] },
  [T.SQL_DB]: { title: "Create SQL database", fields: [{ name: "resourceGroup", label: "Resource group", kind: "rg", required: true }, { name: "serverName", label: "Server", kind: "resource", resourceType: T.SQL_SERVER, required: true }, { name: "name", label: "Database name", kind: "text", required: true }, { name: "sku", label: "Compute + storage", kind: "select", options: SQL_SKUS.map((s) => ({ value: s.name, label: `${s.name} ~$${s.monthly}/mo` })), default: "Basic" }, { name: "sampleData", label: "Use sample data (Customers, Orders)", kind: "checkbox", default: true }] },
  [T.KEYVAULT]: { title: "Create a key vault", fields: [...base("3-24 chars, globally unique"), { name: "sku", label: "Pricing tier", kind: "select", options: opt(["standard", "premium"]), default: "standard" }, { name: "enableRbacAuthorization", label: "Use Azure RBAC permission model", kind: "checkbox", default: false }, { name: "softDeleteRetentionDays", label: "Soft-delete retention (days)", kind: "number", default: 90 }, { name: "enablePurgeProtection", label: "Enable purge protection", kind: "checkbox", default: false }] },
  [T.WORKSPACE]: { title: "Create Log Analytics workspace", fields: [...base("e.g. law-contoso"), { name: "retentionDays", label: "Retention (days)", kind: "number", default: 30 }] },
  [T.APPINSIGHTS]: { title: "Create Application Insights", fields: [...base("e.g. appi-contoso"), { name: "workspace", label: "Log Analytics workspace", kind: "resource", resourceType: T.WORKSPACE }, { name: "app", label: "Monitored app", kind: "resource", resourceType: T.SITE }] },
  [T.DEVOPS_PROJECT]: { title: "Create DevOps project", fields: [{ name: "resourceGroup", label: "Resource group (billing)", kind: "rg", required: true }, { name: "organization", label: "Organization", kind: "text", required: true, default: "contoso" }, { name: "name", label: "Project name", kind: "text", required: true }, { name: "description", label: "Description", kind: "text" }, { name: "process", label: "Process", kind: "select", options: opt(["Agile", "Scrum", "Basic"]), default: "Agile" }] },
  [T.ACR]: { title: "Create container registry", fields: [...base("5-50 alphanumeric"), { name: "sku", label: "SKU", kind: "select", options: opt(["Basic", "Standard", "Premium"]), default: "Basic" }, { name: "adminUserEnabled", label: "Admin user", kind: "checkbox", default: false, help: "Keep disabled; use Entra ID / managed identity." }] },
  [T.ACI]: { title: "Create container instance", fields: [...base("lowercase, digits, hyphens"), { name: "image", label: "Image", kind: "text", required: true, default: "mcr.microsoft.com/azuredocs/aci-helloworld", help: "Public image or <registry>.azurecr.sim/<repo>:<tag>" }, { name: "cpu", label: "CPU cores", kind: "number", default: 1 }, { name: "memoryGB", label: "Memory (GB)", kind: "number", default: 1.5 }, { name: "ports", label: "Ports", kind: "list", default: "80" }, { name: "dnsNameLabel", label: "DNS name label", kind: "text" }] },
  [T.AKS]: { title: "Create Kubernetes cluster", fields: [...base("e.g. aks-contoso"), { name: "kubernetesVersion", label: "Kubernetes version", kind: "select", options: opt(["1.32", "1.31", "1.30"]), default: "1.31" }, { name: "nodeCount", label: "Node count", kind: "number", default: 2 }, { name: "nodeVmSize", label: "Node size", kind: "select", options: opt(VM_SIZES.filter((s) => s.vcpus >= 2).map((s) => s.name)), default: "Standard_D2s_v5" }, { name: "attachAcr", label: "Attach container registry", kind: "resource", resourceType: T.ACR }, { name: "networkPlugin", label: "Network plugin", kind: "select", options: opt(["azure", "kubenet"]), default: "azure" }] },
  [T.BACKUP_VAULT]: { title: "Create Recovery Services vault", fields: [...base("e.g. rsv-contoso"), { name: "redundancy", label: "Storage redundancy", kind: "select", options: opt(["GeoRedundant", "LocallyRedundant", "ZoneRedundant"]), default: "GeoRedundant" }] },
  [T.BUDGET]: { title: "Create budget", fields: [{ name: "name", label: "Name", kind: "text", required: true }, { name: "amount", label: "Amount (USD / month)", kind: "number", required: true, default: 100 }, { name: "resourceGroup", label: "Scope: resource group (optional)", kind: "rg" }, { name: "thresholds", label: "Alert thresholds (%)", kind: "list", default: "50, 80, 100" }, { name: "contactEmail", label: "Alert email", kind: "text" }] },
};

/** Converts flat form values into the API input shape. */
export function toInput(type: string, v: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) if (val !== "" && val !== undefined && val !== null) out[k] = val;
  if (type === T.VNET) {
    out.subnets = out.subnetName && out.subnetPrefix ? [{ name: out.subnetName, addressPrefix: out.subnetPrefix }] : [];
    delete out.subnetName;
    delete out.subnetPrefix;
  }
  if (type === T.ACI && Array.isArray(out.ports)) out.ports = (out.ports as string[]).map(Number);
  if (type === T.BUDGET && Array.isArray(out.thresholds)) out.thresholds = (out.thresholds as string[]).map(Number);
  return out;
}
