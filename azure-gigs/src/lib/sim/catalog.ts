export const REGIONS = [
  { name: "eastus", displayName: "East US" },
  { name: "eastus2", displayName: "East US 2" },
  { name: "westus2", displayName: "West US 2" },
  { name: "centralus", displayName: "Central US" },
  { name: "northeurope", displayName: "North Europe" },
  { name: "westeurope", displayName: "West Europe" },
  { name: "uksouth", displayName: "UK South" },
  { name: "centralindia", displayName: "Central India" },
  { name: "southindia", displayName: "South India" },
  { name: "southeastasia", displayName: "Southeast Asia" },
  { name: "japaneast", displayName: "Japan East" },
  { name: "australiaeast", displayName: "Australia East" },
];
export const REGION_NAMES = REGIONS.map((r) => r.name);

export const VM_SIZES = [
  { name: "Standard_B1s", vcpus: 1, memoryGiB: 1, hourly: 0.0104 },
  { name: "Standard_B1ms", vcpus: 1, memoryGiB: 2, hourly: 0.0207 },
  { name: "Standard_B2s", vcpus: 2, memoryGiB: 4, hourly: 0.0416 },
  { name: "Standard_B2ms", vcpus: 2, memoryGiB: 8, hourly: 0.0832 },
  { name: "Standard_D2s_v5", vcpus: 2, memoryGiB: 8, hourly: 0.096 },
  { name: "Standard_D4s_v5", vcpus: 4, memoryGiB: 16, hourly: 0.192 },
  { name: "Standard_D8s_v5", vcpus: 8, memoryGiB: 32, hourly: 0.384 },
  { name: "Standard_E4s_v5", vcpus: 4, memoryGiB: 32, hourly: 0.252 },
  { name: "Standard_F4s_v2", vcpus: 4, memoryGiB: 8, hourly: 0.169 },
];

export const VM_IMAGES = [
  { urn: "Canonical:ubuntu-24_04-lts:server:latest", alias: "Ubuntu2404", os: "Linux", display: "Ubuntu Server 24.04 LTS" },
  { urn: "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest", alias: "Ubuntu2204", os: "Linux", display: "Ubuntu Server 22.04 LTS" },
  { urn: "Debian:debian-12:12-gen2:latest", alias: "Debian12", os: "Linux", display: "Debian 12" },
  { urn: "RedHat:RHEL:9-lvm-gen2:latest", alias: "RHELRaw9", os: "Linux", display: "Red Hat Enterprise Linux 9" },
  { urn: "MicrosoftWindowsServer:WindowsServer:2022-datacenter-azure-edition:latest", alias: "Win2022AzureEdition", os: "Windows", display: "Windows Server 2022 Datacenter: Azure Edition" },
  { urn: "MicrosoftWindowsServer:WindowsServer:2019-datacenter-gensecond:latest", alias: "Win2019Datacenter", os: "Windows", display: "Windows Server 2019 Datacenter" },
];

export function findImage(input: string) {
  const k = input.toLowerCase();
  return VM_IMAGES.find((i) => i.alias.toLowerCase() === k || i.urn.toLowerCase() === k);
}
export function findSize(input: string) {
  return VM_SIZES.find((s) => s.name.toLowerCase() === input.toLowerCase());
}

export const STORAGE_SKUS = ["Standard_LRS", "Standard_ZRS", "Standard_GRS", "Standard_RAGRS", "Standard_GZRS", "Premium_LRS", "Premium_ZRS"];
export const DISK_SKUS = ["Standard_LRS", "StandardSSD_LRS", "Premium_LRS"];
export const APP_RUNTIMES = ["NODE|20-lts", "NODE|22-lts", "PYTHON|3.12", "DOTNETCORE|8.0", "JAVA|17-java17", "PHP|8.3"];
export const PLAN_SKUS = [
  { name: "F1", tier: "Free", monthly: 0 },
  { name: "B1", tier: "Basic", monthly: 13.14 },
  { name: "S1", tier: "Standard", monthly: 69.35 },
  { name: "P1v3", tier: "PremiumV3", monthly: 124.1 },
];
export const SQL_SKUS = [
  { name: "Basic", monthly: 4.9 },
  { name: "S0", monthly: 14.72 },
  { name: "S1", monthly: 29.43 },
  { name: "GP_S_Gen5_1", monthly: 80 },
];

/** Rough monthly USD prices used for cost estimates (illustrative, not official pricing). */
export const MONTHLY_PRICE: Record<string, number> = {
  "Microsoft.Network/publicIPAddresses": 3.65,
  "Microsoft.KeyVault/vaults": 0.5,
  "Microsoft.ContainerRegistry/registries": 5,
  "Microsoft.OperationalInsights/workspaces": 2.3,
  "Microsoft.Insights/components": 1.0,
  "Microsoft.RecoveryServices/vaults": 5,
  "Microsoft.Sql/servers": 0,
};
