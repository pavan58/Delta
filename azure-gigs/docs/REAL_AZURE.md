# Connecting a real Azure subscription (Real Azure Mode)

Real Azure Mode lets a learner list and manage resources in **their own** subscription. Virtual Azure Mode is unaffected and stays the default.

## 1. Register an application (once per deployment)

1. In Microsoft Entra ID, go to **App registrations → New registration**.
   - Supported account types: *Accounts in any organizational directory* (multi-tenant), or single tenant for a class.
   - Redirect URI (Web): `https://<APP_URL>/api/azure/callback`
2. **API permissions → Add → Azure Service Management → Delegated → `user_impersonation`**.
3. **Certificates & secrets → New client secret.** Store it in your secret store.
4. Set `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT` (`organizations` or your tenant id) and `APP_URL`.

## 2. How it works

- **Authorization code flow with PKCE.** The state and verifier sit in short-lived httpOnly cookies scoped to `/api/azure`, and the state is compared in constant time.
- The only scope requested is `https://management.azure.com/user_impersonation offline_access openid profile`. What a learner can do is still limited by **their own Azure RBAC** (least privilege). Recommend they use a sandbox subscription or a resource group where they hold Contributor.
- Access and refresh tokens are **AES-256-GCM encrypted** in `ConnectedAzureAccount`. They are refreshed server-side and never sent to the browser. Disconnecting deletes them.
- Calls go to Azure Resource Manager REST APIs from the server:
  - list subscriptions, resource groups and resources in a group
  - create resource groups (no cost)
  - create storage accounts: the UI first shows an estimate from the public Azure Retail Prices API and requires an explicit "I understand this is billable" confirmation, which the API enforces (`confirmCost: true`)
  - delete resource groups: you must type the group's name
  - read resource metrics (`microsoft.insights/metrics`)
- Every real action is written to the audit log (`azure.connect`, `azure.rg.create`, `azure.storage.create`, `azure.rg.delete`).
- Real resources show in a separate page with a warning banner. Simulated resources are never presented as running in Azure.

## Limitations

- The web terminal does not run the real Azure CLI against your subscription. Real Azure Mode uses the same ARM REST APIs the CLI uses, through the portal UI. This is deliberate: running user-supplied CLI commands on the server would be a security risk.
- Real Azure Mode supports resource groups, storage accounts, listing and metrics. Real VMs, networks and other services are not provisioned from the app yet. Extend `src/lib/azure/real.ts` with the same confirm-cost pattern.
