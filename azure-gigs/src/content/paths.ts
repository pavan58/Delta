/** Learning paths, modules, assessments and the Contoso company environment. */
export type ModuleDef = { slug: string; title: string; description: string; labs: string[] };
export type Question = { q: string; options: string[]; answer: number; explanation: string };
export type PathDef = { slug: string; title: string; description: string; level: string; modules: ModuleDef[]; assessment: Question[] };

const Q = (q: string, options: string[], answer: number, explanation: string): Question => ({ q, options, answer, explanation });

const FUNDAMENTALS_Q: Question[] = [
  Q("Which is a billing and management boundary in Azure?", ["Tenant", "Subscription", "Resource tag", "Region pair"], 1, "Subscriptions are billing/management boundaries trusted by one Entra tenant."),
  Q("A resource group can contain resources from multiple regions.", ["True", "False"], 0, "The RG location only stores metadata."),
  Q("Which redundancy keeps copies in three availability zones in one region?", ["LRS", "ZRS", "GRS", "RA-GRS"], 1, "ZRS replicates synchronously across 3 zones."),
  Q("What happens to compute billing when a VM is deallocated?", ["Continues", "Stops", "Doubles", "Moves to storage tier"], 1, "Deallocated VMs release compute; only disks are billed."),
  Q("Which model is Azure Functions on the Consumption plan?", ["IaaS", "PaaS/Serverless", "SaaS", "On-premises"], 1, "Serverless: pay per execution, scale to zero."),
  Q("Which tool helps you get alerted before overspending?", ["Azure Advisor", "Budgets in Cost Management", "Resource locks", "Azure Policy"], 1, "Budgets send alerts at thresholds."),
  Q("Which service provides identity for Azure?", ["Key Vault", "Microsoft Entra ID", "Azure Monitor", "Defender"], 1, "Entra ID is the identity platform."),
  Q("What is the shared responsibility for patching the OS of an IaaS VM?", ["Microsoft", "Customer", "Nobody", "The ISP"], 1, "In IaaS the customer manages the guest OS."),
  Q("A paired region is used primarily for…", ["Lower latency", "Disaster recovery and sequential updates", "Cheaper pricing", "Bigger VMs"], 1, "Region pairs support DR and staggered updates."),
  Q("Which tag strategy helps chargeback?", ["costCenter tag", "Random names", "No tags", "Location only"], 0, "Tags such as costCenter enable cost allocation."),
];
const ADMIN_Q: Question[] = [
  Q("NSG rule priority 100 Deny and priority 200 Allow on port 80. Result for port 80?", ["Allowed", "Denied", "Depends on NIC", "Random"], 1, "Lowest number wins; first match stops processing."),
  Q("Which role lets a user manage VMs but not networks?", ["Contributor", "Virtual Machine Contributor", "Owner", "Reader"], 1, "VM Contributor excludes network writes except NICs."),
  Q("How many IP addresses does Azure reserve in each subnet?", ["2", "3", "5", "8"], 2, "Network, gateway, 2x DNS and broadcast."),
  Q("VNet peering is transitive.", ["True", "False"], 1, "It is not; use a hub NVA/firewall or Virtual WAN."),
  Q("Which Key Vault setting prevents permanent deletion during retention?", ["Soft delete", "Purge protection", "RBAC", "Private link"], 1, "Purge protection blocks purge until retention expires."),
  Q("Data-plane access to blobs with Entra ID requires…", ["Storage Account Contributor", "Storage Blob Data Reader/Contributor", "Reader", "Owner"], 1, "Data actions come from Storage Blob Data roles."),
  Q("Which tool shows which NSG rule allowed/denied a flow?", ["IP flow verify", "Cost analysis", "Advisor", "Boot diagnostics"], 0, "Network Watcher IP flow verify."),
  Q("Recovery Services vault can back up VMs from any region.", ["True", "False"], 1, "The vault must be in the same region as the VM."),
  Q("Default outbound NSG rules allow…", ["Nothing", "Internet and VNet traffic", "Only VNet", "Only Azure services"], 1, "AllowVnetOutBound and AllowInternetOutBound."),
  Q("Best way to give a web app access to Key Vault?", ["Store a client secret in app settings", "Managed identity + access policy/RBAC", "Owner role", "Public network access"], 1, "Managed identities avoid secrets."),
];
const DEVOPS_Q: Question[] = [
  Q("Where should a pipeline's Azure credentials come from?", ["Hard-coded YAML", "A service connection (workload identity)", "A text file in the repo", "Email"], 1, "Service connections, ideally with workload identity federation."),
  Q("Which construct gates production deployments with approvals?", ["Environments", "Variables", "Artifacts", "Triggers"], 0, "Environments support approvals and checks."),
  Q("ImagePullBackOff on AKS pulling from ACR usually means…", ["CPU too low", "Missing pull permission or wrong tag", "Disk full", "DNS TTL"], 1, "Attach ACR / AcrPull or fix image name."),
  Q("What does a branch policy requiring PRs prevent?", ["Direct pushes to the protected branch", "Creating branches", "Running pipelines", "Cloning"], 0, "Changes must go through reviewed PRs."),
  Q("kubectl command to see why a pod is failing?", ["kubectl describe pod <name>", "kubectl version", "kubectl config view", "kubectl cluster-info"], 0, "describe shows events and state."),
  Q("CrashLoopBackOff indicates…", ["Image cannot be pulled", "Container repeatedly starts and exits", "Node is full", "Service missing"], 1, "Check logs/config."),
  Q("A YAML pipeline stage contains…", ["Jobs", "Repos", "Boards", "Wikis"], 0, "Stages → jobs → steps."),
  Q("Blue/green on App Service is usually done with…", ["Deployment slots", "Resource locks", "Tags", "Budgets"], 0, "Slots + swap."),
];
const SUPPORT_Q: Question[] = [
  Q("First thing to check when a resource suddenly breaks?", ["Activity log for recent changes", "Reinstall OS", "Delete and recreate", "Open a P1 immediately without data"], 0, "Recent changes cause most incidents."),
  Q("App returns 500 and logs 'Key Vault reference failed'. Likely cause?", ["Secret expired/disabled or identity lacks access", "DNS", "NSG", "Disk full"], 0, "KV references fail on expiry or missing permission."),
  Q("'No space left on device' on a VM. Quick safe fix?", ["Delete /", "Clean logs / expand disk and restart service", "Reboot only", "Disable monitoring"], 1, "Free space then restart."),
  Q("Good RCA contains…", ["Blame", "Timeline, root cause, fix, verification, prevention", "Only the fix", "Only screenshots"], 1, "Standard RCA structure."),
  Q("Metric shows CPU 98% with normal traffic. Next step?", ["Scale up immediately", "Find the process consuming CPU", "Delete VM", "Ignore"], 1, "Investigate before scaling."),
  Q("Storage 403 AuthorizationFailure from an app after a security change. Check…", ["Firewall/network rules", "Blob tier", "Redundancy", "Tags"], 0, "Network rules commonly cause 403."),
];

export const PATHS: PathDef[] = [
  { slug: "az-900-fundamentals", title: "Azure Fundamentals (AZ-900 preparation)", description: "Cloud concepts, core services, pricing, identity and governance basics - hands-on.", level: "Beginner", assessment: FUNDAMENTALS_Q, modules: [
    { slug: "az900-cloud-concepts", title: "Cloud concepts & accounts", description: "Tenants, subscriptions, regions.", labs: ["azure-account-and-subscriptions", "regions-and-availability", "rg-dev-eastus", "rg-test-westeurope"] },
    { slug: "az900-core-services", title: "Core services", description: "Compute, storage and networking basics.", labs: ["create-resource-group", "deploy-storage-account", "create-first-vm", "storage-standard-lrs-hot-1"] },
    { slug: "az900-governance", title: "Pricing & governance", description: "Budgets, tags, identity.", labs: ["pricing-and-budgets", "entra-users-groups"] },
  ] },
  { slug: "az-104-administrator", title: "Azure Administrator (AZ-104 preparation)", description: "Identity, governance, storage, compute, networking, monitoring and backup.", level: "Intermediate", assessment: [...ADMIN_Q, ...FUNDAMENTALS_Q.slice(0, 4)], modules: [
    { slug: "az104-identity", title: "Identities & governance", description: "Entra ID, RBAC.", labs: ["entra-users-groups", "rbac-least-privilege", "rbac-arjun-reader"] },
    { slug: "az104-storage", title: "Storage", description: "Accounts, redundancy, firewalls.", labs: ["deploy-storage-account", "storage-standard-grs-cool-3", "private-access-storage-firewall"] },
    { slug: "az104-compute", title: "Compute", description: "VMs, App Service, containers.", labs: ["create-first-vm", "vm-win-iis", "deploy-app-service", "docker-acr-aci"] },
    { slug: "az104-networking", title: "Networking", description: "VNets, NSGs, peering.", labs: ["configure-vnet-subnets", "configure-nsg-web", "vnet-peering-hub-spoke", "web-vm-nsg-troubleshooting"] },
    { slug: "az104-monitor-backup", title: "Monitor & back up", description: "Alerts, KQL, backup.", labs: ["monitor-alerts", "kql-fundamentals", "backup-and-restore-vm"] },
  ] },
  { slug: "azure-devops-engineer", title: "Azure DevOps Engineer", description: "Boards, repos, pipelines, containers and AKS delivery.", level: "Advanced", assessment: DEVOPS_Q, modules: [
    { slug: "devops-boards-repos", title: "Boards & repos", description: "Work items, branches, PRs.", labs: ["pipeline-boards", "pipeline-branch-policy"] },
    { slug: "devops-pipelines", title: "Pipelines", description: "YAML CI/CD.", labs: ["pipeline-fix-yaml", "cicd-pipeline-app-service", "incident-pipeline-failure"] },
    { slug: "devops-containers", title: "Containers", description: "ACR, ACI, AKS.", labs: ["docker-acr-aci", "aks-deploy-and-troubleshoot", "pipeline-docker-acr"] },
    { slug: "devops-capstone", title: "Capstones", description: "End-to-end delivery.", labs: ["capstone-cicd", "capstone-devops-aks"] },
  ] },
  { slug: "azure-cloud-support", title: "Azure Cloud Support", description: "Ticket-driven troubleshooting across compute, storage, identity and apps.", level: "Intermediate", assessment: [...SUPPORT_Q, ...ADMIN_Q.slice(0, 4)], modules: [
    { slug: "support-basics", title: "Support fundamentals", description: "Evidence-based troubleshooting.", labs: ["web-vm-nsg-troubleshooting", "kql-activity-deletes"] },
    { slug: "support-incidents", title: "Incident handling", description: "Common customer issues.", labs: ["incident-vm-unavailable", "incident-storage-access-denied", "incident-rbac-wrong", "incident-expired-secret"] },
  ] },
  { slug: "azure-infrastructure-engineer", title: "Azure Infrastructure Engineer", description: "Network design, IaC, security and resilience.", level: "Advanced", assessment: [...ADMIN_Q.slice(0, 7), ...SUPPORT_Q.slice(0, 3)], modules: [
    { slug: "infra-network", title: "Network architecture", description: "Subnetting, hub-spoke.", labs: ["vnet-design-finance", "vnet-design-analytics", "vnet-peering-hub-spoke", "capstone-secure-network"] },
    { slug: "infra-iac", title: "Infrastructure as code", description: "Repeatable environments.", labs: ["bicep-style-iac"] },
    { slug: "infra-resilience", title: "Resilience", description: "HA & backup.", labs: ["backup-and-restore-vm", "capstone-ha-web-app"] },
  ] },
  { slug: "azure-sre-engineer", title: "Azure SRE Engineer", description: "Observability, alerting, KQL and incident response.", level: "Advanced", assessment: [...SUPPORT_Q, ...DEVOPS_Q.slice(2, 6)], modules: [
    { slug: "sre-observability", title: "Observability", description: "Metrics, logs, KQL.", labs: ["monitor-alerts", "kql-fundamentals", "kql-top-cpu", "kql-p95-latency", "capstone-monitoring"] },
    { slug: "sre-incidents", title: "Incident response", description: "On-call practice.", labs: ["incident-high-cpu", "incident-disk-full", "incident-dns-failure"] },
  ] },
  { slug: "azure-production-support", title: "Azure Production Support", description: "Full production support simulation with SLAs and RCAs.", level: "Advanced", assessment: SUPPORT_Q, modules: [
    { slug: "prodsupport-shadow", title: "Shadow & reverse shadow", description: "Guided incidents.", labs: ["incident-nsg-deny-http", "incident-db-connection-failure"] },
    { slug: "prodsupport-independent", title: "Independent execution", description: "Handle incidents alone.", labs: ["incident-high-cpu", "incident-disk-full", "incident-pipeline-failure", "capstone-outage"] },
  ] },
];

export const COMPANY = {
  name: "Contoso Digital Services",
  role: "Junior Azure Cloud Engineer",
  mentor: { name: "Rahul Sharma", title: "Senior Azure DevOps Engineer", upn: "rahul.sharma@contoso.sim.azuregigs.local" },
  environments: [
    { name: "Development", rg: "rg-web-dev", purpose: "Feature work. Break things safely." },
    { name: "Testing", rg: "rg-test-*", purpose: "Automated tests and QA." },
    { name: "Staging", rg: "rg-staging-*", purpose: "Production-like validation and approvals." },
    { name: "Production", rg: "rg-contoso-prod", purpose: "Customer-facing. Changes need a change request; incidents are injected here." },
  ],
  teams: [
    { name: "Engineering", lead: "Sneha Kulkarni", focus: "Builds the web and API services." },
    { name: "Cloud Operations", lead: "Arjun Mehta", focus: "Runs the platform, on-call rotation, backups." },
    { name: "Security", lead: "Priya Nair", focus: "Network hardening, Key Vault, access reviews." },
    { name: "Incident Management", lead: "Arjun Mehta", focus: "Sev1-Sev3 coordination, RCAs." },
    { name: "Change Management", lead: "Vikram Rao", focus: "CAB approvals, change windows." },
  ],
  progression: [
    { stage: "Observe", description: "Watch Rahul walk through the platform. Read runbooks.", labs: ["azure-account-and-subscriptions", "regions-and-availability"] },
    { stage: "Shadow", description: "Follow along while Rahul builds; you repeat each step.", labs: ["create-resource-group", "deploy-storage-account", "create-first-vm"] },
    { stage: "Reverse Shadow", description: "You build, Rahul reviews.", labs: ["configure-vnet-subnets", "configure-nsg-web", "rbac-least-privilege"] },
    { stage: "Guided Execution", description: "You own tasks with hints available.", labs: ["web-vm-nsg-troubleshooting", "deploy-app-service", "key-vault-secrets"] },
    { stage: "Independent Execution", description: "Tickets assigned directly to you.", labs: ["cicd-pipeline-app-service", "backup-and-restore-vm", "aks-deploy-and-troubleshoot"] },
    { stage: "Production Support Simulation", description: "On-call: injected incidents with SLAs.", labs: ["incident-nsg-deny-http", "incident-disk-full", "capstone-outage"] },
  ],
  kt: [
    { title: "KT 1 - Platform tour", presenter: "Rahul Sharma", notes: "Subscriptions, naming (rg-<env>-<region>), mandatory tags env/owner/costCenter, where production lives (rg-contoso-prod)." },
    { title: "KT 2 - Network standards", presenter: "Priya Nair", notes: "Every subnet has an NSG; SSH/RDP never from Internet; use run-command or Bastion; hub-spoke for shared services." },
    { title: "KT 3 - On-call runbook", presenter: "Arjun Mehta", notes: "Check activity log first, then health, metrics, logs. Mitigate before root cause. RCA within 48h with preventive actions." },
    { title: "KT 4 - Release process", presenter: "Vikram Rao", notes: "PRs to main, pipelines deploy to dev→staging→production with approvals; hotfixes still need a CR." },
  ],
};

export type InterviewQ = { topic: string; level: string; q: string; a: string; keywords: string[] };
export const INTERVIEW_QUESTIONS: InterviewQ[] = [
  { topic: "Fundamentals", level: "Fresher", q: "Explain IaaS, PaaS and SaaS with Azure examples.", a: "IaaS: you manage OS and above (VMs). PaaS: platform manages OS/runtime (App Service, Azure SQL). SaaS: complete software (Microsoft 365).", keywords: ["vm", "app service", "os"] },
  { topic: "Fundamentals", level: "Fresher", q: "What is a resource group and how do you organize them?", a: "A logical container for resources sharing a lifecycle; organize by app/environment, use naming conventions and tags, apply RBAC/policy at RG scope.", keywords: ["container", "lifecycle", "tag"] },
  { topic: "Networking", level: "Junior", q: "How do NSG rules get evaluated?", a: "By priority ascending, first match wins, separate inbound/outbound; subnet NSG then NIC NSG for inbound; default rules at 65000+.", keywords: ["priority", "first match", "subnet", "nic"] },
  { topic: "Networking", level: "Junior", q: "Difference between service endpoint and private endpoint?", a: "Service endpoint routes VNet traffic over the backbone to a public endpoint; private endpoint gives the PaaS a private IP in your VNet and allows disabling public access.", keywords: ["private ip", "public", "backbone"] },
  { topic: "Networking", level: "Mid", q: "Two peered VNets can't talk. What do you check?", a: "Peering state Connected on both sides, overlapping address spaces, NSGs, UDRs/firewalls, 'allow forwarded traffic', DNS.", keywords: ["peering", "nsg", "route", "overlap"] },
  { topic: "Compute", level: "Fresher", q: "Stopped vs deallocated VM?", a: "Stopped keeps compute allocated and billed; deallocated releases compute, only storage billed, dynamic IPs released.", keywords: ["billed", "release", "compute"] },
  { topic: "Compute", level: "Junior", q: "How do you make a VM workload highly available?", a: "Availability zones or sets, load balancer, VM scale sets, managed disks, backups, health probes.", keywords: ["zone", "load balancer", "scale set"] },
  { topic: "Identity", level: "Junior", q: "Explain RBAC scope inheritance.", a: "Assignments at management group/subscription/RG/resource; lower scopes inherit; deny assignments override; least privilege at narrowest scope.", keywords: ["scope", "inherit", "least privilege"] },
  { topic: "Identity", level: "Mid", q: "What is a managed identity and why use it?", a: "An Entra identity for an Azure resource, credentials rotated by the platform; avoids storing secrets; system- or user-assigned.", keywords: ["secret", "credential", "system"] },
  { topic: "Storage", level: "Junior", q: "Choose redundancy for a critical app needing zone and region resilience.", a: "GZRS (or RA-GZRS for read access in secondary).", keywords: ["gzrs"] },
  { topic: "Security", level: "Mid", q: "How do you rotate an application secret without downtime?", a: "Store in Key Vault, reference without version, add new version, verify app picks it up (restart/refresh), then disable the old version; better: managed identity.", keywords: ["key vault", "version", "managed identity"] },
  { topic: "Monitoring", level: "Junior", q: "Write a KQL query for the top 5 computers by CPU.", a: "Perf | where CounterName == '% Processor Time' | summarize avg(CounterValue) by Computer | top 5 by avg_CounterValue desc", keywords: ["perf", "summarize", "top"] },
  { topic: "Monitoring", level: "Mid", q: "How would you design alerting for a web app?", a: "Availability tests, Http5xx/response time metric alerts, log alerts for exceptions, action groups to on-call, severities, avoid noise with dynamic thresholds.", keywords: ["action group", "5xx", "threshold"] },
  { topic: "DevOps", level: "Junior", q: "Describe a CI/CD pipeline you would build for App Service.", a: "PR validation build with tests, main build produces artifact, deploy to dev→staging slot→swap to production with approvals, service connection via workload identity.", keywords: ["test", "artifact", "approval", "slot"] },
  { topic: "DevOps", level: "Mid", q: "Pods are in ImagePullBackOff. Steps?", a: "kubectl describe pod for events, verify image name/tag exists in ACR, check AcrPull (az aks update --attach-acr) or imagePullSecret, network to registry.", keywords: ["describe", "acr", "tag"] },
  { topic: "Troubleshooting", level: "Junior", q: "A website on a VM is down. Walk through your troubleshooting.", a: "Check health/power state, activity log, public IP/DNS, NSG effective rules/IP flow verify, guest OS service and port, app logs; mitigate then RCA.", keywords: ["nsg", "activity log", "service", "power"] },
  { topic: "Troubleshooting", level: "Mid", q: "Storage returns 403 for an app. Causes?", a: "Firewall/network rules, missing data-plane RBAC role, SAS expired, shared key disabled, wrong clock skew.", keywords: ["firewall", "role", "sas"] },
  { topic: "Cost", level: "Fresher", q: "Name three ways to reduce Azure cost.", a: "Right-size/deallocate, reservations/savings plans, autoscale, storage tiers/lifecycle, budgets and tagging, Azure Hybrid Benefit.", keywords: ["reservation", "right-size", "tier"] },
  { topic: "Backup", level: "Junior", q: "RPO and RTO - explain and give an example.", a: "RPO: acceptable data loss (daily backup => up to 24h). RTO: time to restore (e.g., 1 hour).", keywords: ["data loss", "time to restore"] },
  { topic: "Containers", level: "Mid", q: "When would you choose ACI over AKS?", a: "Short-lived/simple containers, burst jobs, no orchestration needed; AKS for microservices needing scaling, service discovery and rolling updates.", keywords: ["orchestration", "simple"] },
];
