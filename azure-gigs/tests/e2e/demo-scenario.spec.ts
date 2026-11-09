import { test, expect, Page } from "@playwright/test";

/**
 * The MVP end-to-end demonstration (spec section 22), driven entirely through the browser
 * against the real backend and persistent simulator state.
 */
const id = Date.now().toString(36);
const email = `e2e-${id}@example.com`;
const password = "E2e-Passw0rd-123";

async function createViaBlade(page: Page, button: RegExp | string, fill: (p: Page) => Promise<void>) {
  await page.getByRole("button", { name: button }).first().click();
  await fill(page);
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Review + create" }).last().click();
  await dlg.getByRole("button", { name: "Create", exact: true }).click();
}

test("register → build → break → diagnose → fix → verify → grade", async ({ page }) => {
  // 1. Register
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Welcome to Contoso Digital Services")).toBeVisible();

  // 2. Sign out and sign in again
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // 3. Portal dashboard
  await expect(page.getByRole("heading", { name: "Azure services" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Learner dashboard" })).toBeVisible();

  // Start the lab before doing the work
  await page.goto("/labs/web-vm-nsg-troubleshooting");
  await page.getByRole("button", { name: "Start lab" }).click();
  await expect(page.getByText("Lab started.")).toBeVisible();

  // 4. Resource group
  await page.goto("/resource-groups");
  await createViaBlade(page, "Create", async (p) => {
    await p.getByLabel("Resource group name").fill("rg-demo");
    await p.getByLabel("Region").selectOption("eastus");
    await p.getByLabel("Tags").fill("env=dev, owner=e2e");
  });
  await expect(page.getByText("Deployment succeeded: rg-demo")).toBeVisible();

  // 5. Virtual network (no initial subnet)
  await page.goto("/virtual-networks");
  await createViaBlade(page, "Create", async (p) => {
    await p.getByLabel("Resource group").selectOption("rg-demo");
    await p.getByRole("textbox", { name: "Name", exact: true }).fill("vnet-demo");
    await p.getByLabel("IPv4 address space").fill("10.1.0.0/16");
    await p.getByLabel("First subnet name").fill("");
    await p.getByLabel("First subnet range").fill("");
  });
  await expect(page.getByText("Deployment succeeded: vnet-demo")).toBeVisible();

  // 6. Subnet
  await page.getByRole("link", { name: "vnet-demo" }).click();
  await page.getByRole("tab", { name: "Subnets" }).click();
  await page.getByLabel("Subnet name").fill("snet-web");
  await page.getByLabel("Subnet address range").fill("10.1.1.0/24");
  await page.getByRole("button", { name: "Add subnet" }).click();
  await expect(page.getByRole("cell", { name: "snet-web", exact: true })).toBeVisible();
  // Overlap validation
  await page.getByLabel("Subnet name").fill("snet-bad");
  await page.getByLabel("Subnet address range").fill("10.1.1.128/25");
  await page.getByRole("button", { name: "Add subnet" }).click();
  await expect(page.getByText(/snet-web.*overlaps with subnet 'snet-bad'/)).toBeVisible();

  // 7. NSG
  await page.goto("/network-security-groups");
  await createViaBlade(page, "Create", async (p) => {
    await p.getByLabel("Resource group").selectOption("rg-demo");
    await p.getByRole("textbox", { name: "Name", exact: true }).fill("nsg-demo-web");
  });
  await expect(page.getByText("Deployment succeeded: nsg-demo-web")).toBeVisible();

  // 8. Inbound rule
  await page.getByRole("link", { name: "nsg-demo-web" }).click();
  await page.getByRole("tab", { name: "Security rules" }).click();
  await page.locator("#rule-name").fill("allow-http");
  await page.locator("#rule-priority").fill("200");
  await page.locator("#rule-sourceAddressPrefix").fill("Internet");
  await page.locator("#rule-destinationPortRange").fill("80");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByRole("cell", { name: "allow-http", exact: true })).toBeVisible();

  // 9-10. VM attached to the subnet with the NSG
  await page.goto("/virtual-machines");
  await page.getByRole("button", { name: "Create" }).first().click();
  await page.getByLabel("Resource group").selectOption("rg-demo");
  await page.getByLabel("Virtual machine name").fill("vm-web-01");
  await page.getByLabel("Image").selectOption("Ubuntu2204");
  await page.getByLabel("Size").selectOption("Standard_B2s");
  await page.getByRole("tab", { name: "Networking" }).click();
  await page.getByLabel("Virtual network").selectOption("vnet-demo");
  await page.getByLabel("Subnet").selectOption("snet-web");
  await page.getByLabel("NIC network security group").selectOption("existing");
  await page.getByLabel("Network security group", { exact: true }).selectOption("nsg-demo-web");
  await page.getByRole("tab", { name: "Management" }).click();
  await page.getByLabel("Install web server").check();
  await page.getByRole("tab", { name: "Review + create" }).click();
  await expect(page.getByText("Validation passed.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name: "vm-web-01" })).toBeVisible();

  // 12. Inspect configuration
  await expect(page.getByText("10.1.1.4")).toBeVisible();
  await expect(page.getByText("VM running").first()).toBeVisible();

  // 11. Azure CLI
  await page.goto("/terminal");
  const term = page.getByLabel("Command");
  await term.fill("az login");
  await term.press("Enter");
  await expect(page.getByText("exit 0").first()).toBeVisible();
  await term.fill("az vm show -g rg-demo -n vm-web-01 -d --query \"{name:name, power:powerState, ip:privateIps}\" -o table");
  await term.press("Enter");
  await expect(page.getByLabel("Terminal output").getByText(/vm-web-01\s+VM running\s+10\.1\.1\.4/)).toBeVisible();

  // 13. Inject the NSG fault
  await page.goto("/interview");
  await page.getByLabel("Fault type").selectOption("nsg-deny-http");
  await page.getByRole("button", { name: "Inject fault & open ticket" }).click();
  const panel = page.getByTestId("incident-panel");
  await expect(panel.getByText("Website unreachable after a security change")).toBeVisible();

  // 14. Diagnose: connectivity check fails on the NSG hop
  await page.goto("/virtual-machines");
  await page.getByRole("link", { name: "vm-web-01" }).click();
  await page.getByRole("tab", { name: "Connect & troubleshoot" }).click();
  await page.getByRole("button", { name: "Run check" }).click();
  const result = page.getByTestId("connectivity-result");
  await expect(result.getByText("Unreachable")).toBeVisible();
  await expect(result.getByText(/Harden-DenyHTTP-Inbound/)).toBeVisible();

  // 15. Correct the security rule
  await page.goto("/network-security-groups");
  await page.getByRole("link", { name: "nsg-demo-web" }).click();
  await page.getByRole("tab", { name: "Security rules" }).click();
  await page.getByRole("button", { name: "Delete rule Harden-DenyHTTP-Inbound" }).click();
  await expect(page.getByRole("cell", { name: "Harden-DenyHTTP-Inbound", exact: true })).toHaveCount(0);

  // 16. Verify connectivity
  await page.goto("/virtual-machines");
  await page.getByRole("link", { name: "vm-web-01" }).click();
  await page.getByRole("tab", { name: "Connect & troubleshoot" }).click();
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.getByTestId("connectivity-result").getByText("Reachable", { exact: true })).toBeVisible();

  // Resolve the incident with an RCA
  await page.goto("/interview");
  await page.getByLabel("Root cause").fill("A Deny rule Harden-DenyHTTP-Inbound for TCP 80 was added to the NSG with a lower priority number than allow-http, so it was evaluated first.");
  await page.getByLabel("Fix applied").fill("Deleted the deny rule after confirming HTTP must remain open for the HTTPS redirect.");
  await page.getByLabel("Verification").fill("Connectivity check from Internet to vm-web-01:80 returns Reachable.");
  await page.getByRole("button", { name: "Resolve incident" }).click();
  await expect(page.getByText(/Incident resolved\./)).toBeVisible();

  // 17-18. Submit the lab and receive the automatic score
  await page.goto("/labs/web-vm-nsg-troubleshooting");
  await page.getByLabel(/Notes \/ documentation/).fill("Built the web tier behind nsg-demo-web. The incident was an NSG deny rule with a lower priority number than allow-http; I removed it and verified port 80 with a connectivity check.");
  await page.getByRole("button", { name: "Submit lab" }).click();
  const score = page.getByTestId("lab-result");
  await expect(score.getByText("Score: 100/100 - Passed")).toBeVisible();

  // 19. Progress persisted
  await page.goto("/dashboard");
  await expect(page.getByText("1 / 110")).toBeVisible();
  await page.goto("/labs");
  await page.getByLabel("Status").selectOption("completed");
  await expect(page.getByRole("link", { name: "Deploy a web VM, break it, and fix it (end-to-end)" })).toBeVisible();
});

test("every primary navigation item opens a working page", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Nav Tester");
  await page.getByLabel("Email").fill(`nav-${id}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home/);
  const hrefs = await page.locator('nav[aria-label="Primary"] a').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!))]);
  expect(hrefs.length).toBeGreaterThanOrEqual(23);
  for (const href of hrefs) {
    const resp = await page.goto(href);
    expect(resp?.status(), href).toBe(200);
    await expect(page.locator("main h1, main h2").first(), href).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  }
});

test("unauthenticated users are redirected and APIs reject them", async ({ page, request }) => {
  await page.goto("/virtual-machines");
  await expect(page).toHaveURL(/\/login/);
  const r = await request.get("/api/resources");
  expect(r.status()).toBe(401);
});
