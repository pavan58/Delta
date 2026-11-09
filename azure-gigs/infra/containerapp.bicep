// Azure Container Apps deployment for Azure Gigs (web app + migration job).
// az deployment group create -g rg-azuregigs -f infra/containerapp.bicep -p image=<acr>.azurecr.io/azure-gigs:<tag> toolsImage=<acr>.azurecr.io/azure-gigs-tools:<tag> ...
param location string = resourceGroup().location
param name string = 'azure-gigs'
param image string
param toolsImage string
param acrLoginServer string
param appUrl string
@secure()
param databaseUrl string
@secure()
param encryptionKey string
@secure()
param azureAdClientSecret string = ''
param azureAdClientId string = ''

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-id'
  location: location
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: { customerId: logs.properties.customerId, sharedKey: logs.listKeys().primarySharedKey }
    }
  }
}

var secrets = [
  { name: 'database-url', value: databaseUrl }
  { name: 'encryption-key', value: encryptionKey }
  { name: 'azure-ad-client-secret', value: empty(azureAdClientSecret) ? 'unset' : azureAdClientSecret }
]
var envVars = [
  { name: 'DATABASE_URL', secretRef: 'database-url' }
  { name: 'ENCRYPTION_KEY', secretRef: 'encryption-key' }
  { name: 'APP_URL', value: appUrl }
  { name: 'AZURE_AD_CLIENT_ID', value: azureAdClientId }
  { name: 'AZURE_AD_CLIENT_SECRET', secretRef: 'azure-ad-client-secret' }
]

resource migrate 'Microsoft.App/jobs@2024-03-01' = {
  name: '${name}-migrate'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 600
      secrets: secrets
      registries: [ { server: acrLoginServer, identity: identity.id } ]
    }
    template: { containers: [ { name: 'migrate', image: toolsImage, env: envVars, resources: { cpu: json('0.5'), memory: '1Gi' } } ] }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 3000, transport: 'auto', allowInsecure: false }
      secrets: secrets
      registries: [ { server: acrLoginServer, identity: identity.id } ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          env: envVars
          resources: { cpu: json('1.0'), memory: '2Gi' }
          probes: [ { type: 'Liveness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 30 } ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 1 } // in-memory rate limiting: scale out only with REDIS_URL configured
    }
  }
}

output url string = 'https://${app.properties.configuration.ingress.fqdn}'
output identityPrincipalId string = identity.properties.principalId
