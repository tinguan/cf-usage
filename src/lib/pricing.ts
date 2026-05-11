export type TierName = "free" | "paid" | "custom";

export interface ResourceLimit {
  requests?: number; // per month
  requestsPerDay?: number; // per day
  cpuMs?: number; // cpu milliseconds per day
  storageGB?: number;
  classAOps?: number; // per month
  classBOps?: number; // per month
  reads?: number; // per day
  writes?: number; // per day
  deletes?: number; // per day
  rowReads?: number; // per month
  rowWrites?: number; // per month
  builds?: number; // per month
  storedMinutes?: number; // video
  deliveredMinutes?: number;
}

export interface OveragePrice {
  perMillionRequests?: number; // USD
  perMillionCpuMs?: number;
  perGBStorage?: number; // per month
  perMillionClassAOps?: number;
  perMillionClassBOps?: number;
  perMillionReads?: number;
  perMillionWrites?: number;
  perMillionRowReads?: number;
  perMillionRowWrites?: number;
}

export interface ResourcePricing {
  monthlyBase: number; // USD/month plan cost
  free: ResourceLimit;
  paid: ResourceLimit;
  overage: OveragePrice;
}

export const PRICING: Record<string, ResourcePricing> = {
  workers: {
    monthlyBase: 5,
    free: {
      requestsPerDay: 100_000,
      cpuMs: 10, // 10ms per invocation ceiling on free
    },
    paid: {
      requests: 10_000_000, // per month
      cpuMs: 30_000_000, // 30M CPU ms/day
    },
    overage: {
      perMillionRequests: 0.3,
      perMillionCpuMs: 0.02,
    },
  },
  r2: {
    monthlyBase: 0,
    free: {
      storageGB: 10,
      classAOps: 1_000_000,
      classBOps: 10_000_000,
    },
    paid: {
      storageGB: 10, // same free tier, then overage
      classAOps: 1_000_000,
      classBOps: 10_000_000,
    },
    overage: {
      perGBStorage: 0.015,
      perMillionClassAOps: 4.5,
      perMillionClassBOps: 0.36,
    },
  },
  kv: {
    monthlyBase: 0,
    free: {
      reads: 100_000, // per day
      writes: 1_000,
      deletes: 1_000,
      storageGB: 1,
    },
    paid: {
      reads: 100_000,
      writes: 1_000,
      deletes: 1_000,
      storageGB: 1,
    },
    overage: {
      perMillionReads: 0.5,
      perMillionWrites: 5.0,
    },
  },
  d1: {
    monthlyBase: 0, // included in Workers Paid
    free: {
      rowReads: 25_000_000_000, // 25B per month
      rowWrites: 50_000_000, // 50M per month
      storageGB: 5,
    },
    paid: {
      rowReads: 25_000_000_000,
      rowWrites: 50_000_000,
      storageGB: 5,
    },
    overage: {
      perMillionRowReads: 0.001,
      perMillionRowWrites: 1.0,
    },
  },
  pages: {
    monthlyBase: 0,
    free: {
      builds: 500,
    },
    paid: {
      builds: 500,
    },
    overage: {},
  },
};

export function computeEstimatedCost(
  resource: string,
  usage: Record<string, number>,
  tier: TierName,
  customLimits?: ResourceLimit
): number {
  const pricing = PRICING[resource];
  if (!pricing) return 0;

  const limits =
    tier === "custom" && customLimits
      ? customLimits
      : tier === "paid"
        ? pricing.paid
        : pricing.free;

  let cost = 0;
  const o = pricing.overage;

  // Workers
  if (resource === "workers") {
    const reqLimit = limits.requests ?? (limits.requestsPerDay ?? 0) * 30;
    const reqUsed = usage.requests ?? 0;
    if (reqUsed > reqLimit && o.perMillionRequests) {
      cost += ((reqUsed - reqLimit) / 1_000_000) * o.perMillionRequests;
    }
    const cpuUsed = usage.cpuMs ?? 0;
    const cpuLimit = limits.cpuMs ?? Infinity;
    if (cpuUsed > cpuLimit && o.perMillionCpuMs) {
      cost += ((cpuUsed - cpuLimit) / 1_000_000) * o.perMillionCpuMs;
    }
  }

  // R2
  if (resource === "r2") {
    const storageUsed = usage.storageGB ?? 0;
    const storageLimit = limits.storageGB ?? 0;
    if (storageUsed > storageLimit && o.perGBStorage) {
      cost += (storageUsed - storageLimit) * o.perGBStorage;
    }
    const classAUsed = usage.classAOps ?? 0;
    const classALimit = limits.classAOps ?? 0;
    if (classAUsed > classALimit && o.perMillionClassAOps) {
      cost += ((classAUsed - classALimit) / 1_000_000) * o.perMillionClassAOps;
    }
    const classBUsed = usage.classBOps ?? 0;
    const classBLimit = limits.classBOps ?? 0;
    if (classBUsed > classBLimit && o.perMillionClassBOps) {
      cost += ((classBUsed - classBLimit) / 1_000_000) * o.perMillionClassBOps;
    }
  }

  // KV
  if (resource === "kv") {
    const readsUsed = (usage.reads ?? 0) * 30;
    const readsLimit = (limits.reads ?? 0) * 30;
    if (readsUsed > readsLimit && o.perMillionReads) {
      cost += ((readsUsed - readsLimit) / 1_000_000) * o.perMillionReads;
    }
    const writesUsed = (usage.writes ?? 0) * 30;
    const writesLimit = (limits.writes ?? 0) * 30;
    if (writesUsed > writesLimit && o.perMillionWrites) {
      cost += ((writesUsed - writesLimit) / 1_000_000) * o.perMillionWrites;
    }
  }

  // D1
  if (resource === "d1") {
    const rowReadsUsed = usage.rowReads ?? 0;
    const rowReadsLimit = limits.rowReads ?? 0;
    if (rowReadsUsed > rowReadsLimit && o.perMillionRowReads) {
      cost +=
        ((rowReadsUsed - rowReadsLimit) / 1_000_000) * o.perMillionRowReads;
    }
    const rowWritesUsed = usage.rowWrites ?? 0;
    const rowWritesLimit = limits.rowWrites ?? 0;
    if (rowWritesUsed > rowWritesLimit && o.perMillionRowWrites) {
      cost +=
        ((rowWritesUsed - rowWritesLimit) / 1_000_000) *
        o.perMillionRowWrites;
    }
  }

  return cost;
}

export function getUsagePct(
  resource: string,
  metric: string,
  value: number,
  tier: TierName,
  customLimits?: ResourceLimit
): number {
  const pricing = PRICING[resource];
  if (!pricing) return 0;
  const limits =
    tier === "custom" && customLimits
      ? customLimits
      : tier === "paid"
        ? pricing.paid
        : pricing.free;

  const limit = (limits as Record<string, number>)[metric];
  if (!limit || limit === Infinity) return 0;
  return Math.min((value / limit) * 100, 999);
}
