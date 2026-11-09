"use client";
import type { Detail } from "./detail";
import { T } from "@/lib/sim/types";
import { NSG_PANEL, RgOverview, VM_PANEL, VNET_PANEL } from "./panels-compute";
import { AlertOverview, FUNCTION_PANEL, GROUP_PANEL, KV_PANEL, SimpleProps, SITE_PANEL, SQL_DB_PANEL, SQL_SERVER_PANEL, STORAGE_PANEL, USER_PANEL } from "./panels-data";
import { ACI_PANEL, ACR_PANEL, AKS_PANEL, BACKUP_PANEL, DEVOPS_PANEL, LINK_OVERVIEW } from "./panels-devops";

type Props = { d: Detail; reload: () => void };
export type Panel = { tabs: string[]; render: (p: Props & { tab: string }) => React.ReactNode; overview?: (p: Props) => React.ReactNode };

const none = () => null;

export const PANELS: Record<string, Panel> = {
  [T.VM]: VM_PANEL,
  [T.VNET]: VNET_PANEL,
  [T.NSG]: NSG_PANEL,
  [T.RG]: { tabs: [], render: none, overview: RgOverview },
  [T.STORAGE]: STORAGE_PANEL,
  [T.ENTRA_USER]: USER_PANEL,
  [T.ENTRA_GROUP]: GROUP_PANEL,
  [T.SITE]: SITE_PANEL,
  [T.FUNCTION_APP]: FUNCTION_PANEL,
  [T.SQL_SERVER]: SQL_SERVER_PANEL,
  [T.SQL_DB]: SQL_DB_PANEL,
  [T.KEYVAULT]: KV_PANEL,
  [T.ALERT]: { tabs: [], render: none, overview: AlertOverview },
  [T.DEVOPS_PROJECT]: DEVOPS_PANEL,
  [T.ACR]: ACR_PANEL,
  [T.ACI]: ACI_PANEL,
  [T.AKS]: AKS_PANEL,
  [T.BACKUP_VAULT]: BACKUP_PANEL,
  [T.WORKSPACE]: { tabs: [], render: none, overview: LINK_OVERVIEW("/log-analytics", "Open Log Analytics to run KQL queries →") },
  [T.APPINSIGHTS]: { tabs: [], render: none, overview: SimpleProps },
  [T.NIC]: { tabs: [], render: none, overview: SimpleProps },
  [T.PIP]: { tabs: [], render: none, overview: SimpleProps },
  [T.DISK]: { tabs: [], render: none, overview: SimpleProps },
  [T.PLAN]: { tabs: [], render: none, overview: SimpleProps },
  [T.ROLE_ASSIGNMENT]: { tabs: [], render: none, overview: SimpleProps },
  [T.BUDGET]: { tabs: [], render: none, overview: SimpleProps },
  [T.ENTRA_SP]: { tabs: [], render: none, overview: SimpleProps },
};
