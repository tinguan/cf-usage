const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function cfFetch<T>(
  token: string,
  path: string
): Promise<T> {
  const res = await fetch(`${CF_API_BASE}${path}`, { headers: headers(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { success: boolean; result: T; errors?: { message: string }[] };
  if (!json.success) {
    throw new Error(
      `Cloudflare API failure: ${json.errors?.map((e) => e.message).join(", ")}`
    );
  }
  return json.result;
}

export interface CFSubscription {
  id: string;
  state: string;
  price: number;
  currency: string;
  component_values: { name: string; value: number; default: number; price: number }[];
  zone?: { id: string; name: string };
  frequency: string;
  rate_plan: {
    id: string;
    public_name: string;
    currency: string;
    scope: string;
    externally_managed: boolean;
    sets: string[];
    components: { name: string; display_value: string }[];
  };
}

export interface CFBillingEntry {
  id: string;
  type: "charge" | "credit";
  action: { code: string; description: string };
  description: string;
  occurred_at: string;
  amount: number;
  currency: string;
  zone?: { id: string; name: string };
}

export interface CFZone {
  id: string;
  name: string;
  status: string;
  plan: { name: string };
}

export async function getSubscriptions(
  token: string,
  accountId: string
): Promise<CFSubscription[]> {
  return cfFetch<CFSubscription[]>(
    token,
    `/accounts/${accountId}/subscriptions`
  );
}

export async function getBillingHistory(
  token: string,
  accountId: string,
  page = 1
): Promise<CFBillingEntry[]> {
  return cfFetch<CFBillingEntry[]>(
    token,
    `/accounts/${accountId}/billing/history?page=${page}&per_page=50`
  );
}

export async function getZones(
  token: string,
  accountId: string
): Promise<CFZone[]> {
  return cfFetch<CFZone[]>(
    token,
    `/zones?account.id=${accountId}&per_page=50`
  );
}
