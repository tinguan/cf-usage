const CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string; locations?: unknown[] }[];
}

async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(CF_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL HTTP error ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(
      `GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }
  return json.data;
}

// ─── Workers ────────────────────────────────────────────────────────────────

export interface WorkersUsage {
  // Aggregate for the account
  totalRequests: number;
  totalErrors: number;
  totalCpuMs: number;
}

export interface WorkerScriptUsage {
  scriptName: string;
  requests: number;
  errors: number;
  cpuTimeP50: number;
  cpuTimeP99: number;
}

export async function getWorkersUsage(
  token: string,
  accountId: string,
  start: string,
  end: string
): Promise<{ aggregate: WorkersUsage; scripts: WorkerScriptUsage[] }> {
  const query = `
    query WorkersUsage($accountId: String!, $start: String!, $end: String!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          byScript: workersInvocationsAdaptive(
            limit: 10000
            filter: { datetime_geq: $start, datetime_leq: $end }
            orderBy: [sum_requests_DESC]
          ) {
            sum { requests errors subrequests }
            quantiles { cpuTimeP50 cpuTimeP99 }
            dimensions { scriptName }
          }
        }
      }
    }
  `;

  interface GqlResult {
    viewer: {
      accounts: {
        byScript: {
          sum: { requests: number; errors: number; subrequests: number };
          quantiles: { cpuTimeP50: number; cpuTimeP99: number };
          dimensions: { scriptName: string };
        }[];
      }[];
    };
  }

  const data = await gql<GqlResult>(token, query, { accountId, start, end });
  const rows = data.viewer.accounts[0]?.byScript ?? [];

  const scripts: WorkerScriptUsage[] = rows.map((r) => ({
    scriptName: r.dimensions.scriptName,
    requests: r.sum.requests,
    errors: r.sum.errors,
    cpuTimeP50: r.quantiles.cpuTimeP50,
    cpuTimeP99: r.quantiles.cpuTimeP99,
  }));

  const aggregate: WorkersUsage = {
    totalRequests: scripts.reduce((s, r) => s + r.requests, 0),
    totalErrors: scripts.reduce((s, r) => s + r.errors, 0),
    totalCpuMs: scripts.reduce((s, r) => s + r.cpuTimeP99 * r.requests, 0),
  };

  return { aggregate, scripts };
}

// ─── R2 ─────────────────────────────────────────────────────────────────────

export interface R2Usage {
  storageGB: number;
  classAOps: number;
  classBOps: number;
}

export async function getR2Usage(
  token: string,
  accountId: string,
  start: string,
  end: string
): Promise<R2Usage> {
  const query = `
    query R2Usage($accountId: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          storage: r2StorageAdaptiveGroups(
            limit: 1
            filter: { date_geq: $start, date_leq: $end }
          ) {
            max { payloadSize metadataSize }
          }
          ops: r2OperationsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $start, date_leq: $end }
          ) {
            sum { requests }
            dimensions { actionType }
          }
        }
      }
    }
  `;

  interface GqlResult {
    viewer: {
      accounts: {
        storage: { max: { payloadSize: number; metadataSize: number } }[];
        ops: { sum: { requests: number }; dimensions: { actionType: string } }[];
      }[];
    };
  }

  const data = await gql<GqlResult>(token, query, {
    accountId,
    start: start.split("T")[0],
    end: end.split("T")[0],
  });

  const acct = data.viewer.accounts[0];
  const storageBytes =
    (acct?.storage[0]?.max.payloadSize ?? 0) +
    (acct?.storage[0]?.max.metadataSize ?? 0);

  const classA = ["ListBuckets", "PutBucket", "DeleteBucket", "PutObject", "DeleteObject", "CopyObject", "CompleteMultipartUpload"];
  const classAOps =
    acct?.ops
      .filter((r) => classA.includes(r.dimensions.actionType))
      .reduce((s, r) => s + r.sum.requests, 0) ?? 0;

  const classBOps =
    acct?.ops
      .filter((r) => r.dimensions.actionType === "GetObject")
      .reduce((s, r) => s + r.sum.requests, 0) ?? 0;

  return {
    storageGB: storageBytes / 1_073_741_824,
    classAOps,
    classBOps,
  };
}

// ─── KV ─────────────────────────────────────────────────────────────────────

export interface KVUsage {
  reads: number;
  writes: number;
  deletes: number;
  storageGB: number;
}

export async function getKVUsage(
  token: string,
  accountId: string,
  start: string,
  end: string
): Promise<KVUsage> {
  const query = `
    query KVUsage($accountId: String!, $start: String!, $end: String!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          kvOperationsAdaptiveGroups(
            limit: 10000
            filter: { datetime_geq: $start, datetime_leq: $end }
          ) {
            sum { requests }
            dimensions { actionType }
          }
        }
      }
    }
  `;

  interface GqlResult {
    viewer: {
      accounts: {
        kvOperationsAdaptiveGroups: {
          sum: { requests: number };
          dimensions: { actionType: string };
        }[];
      }[];
    };
  }

  const data = await gql<GqlResult>(token, query, { accountId, start, end });
  const rows = data.viewer.accounts[0]?.kvOperationsAdaptiveGroups ?? [];

  // CF KV actionTypes: read, write, delete, list
  return {
    reads: rows.filter((r) => r.dimensions.actionType === "read").reduce((s, r) => s + r.sum.requests, 0),
    writes: rows.filter((r) => r.dimensions.actionType === "write").reduce((s, r) => s + r.sum.requests, 0),
    deletes: rows.filter((r) => r.dimensions.actionType === "delete").reduce((s, r) => s + r.sum.requests, 0),
    storageGB: 0,
  };
}

// ─── D1 ─────────────────────────────────────────────────────────────────────

export interface D1Usage {
  rowReads: number;
  rowWrites: number;
  storageGB: number;
}

export async function getD1Usage(
  token: string,
  accountId: string,
  start: string,
  end: string
): Promise<D1Usage> {
  const query = `
    query D1Usage($accountId: String!, $start: String!, $end: String!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          d1AnalyticsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $start, date_leq: $end }
          ) {
            sum { readQueries writeQueries rowsRead rowsWritten }
          }
        }
      }
    }
  `;

  interface GqlResult {
    viewer: {
      accounts: {
        d1AnalyticsAdaptiveGroups: {
          sum: {
            readQueries: number;
            writeQueries: number;
            rowsRead: number;
            rowsWritten: number;
          };
        }[];
      }[];
    };
  }

  const data = await gql<GqlResult>(token, query, {
    accountId,
    start: start.split("T")[0],
    end: end.split("T")[0],
  });

  const rows = data.viewer.accounts[0]?.d1AnalyticsAdaptiveGroups ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.rowReads += r.sum.rowsRead ?? 0;
      acc.rowWrites += r.sum.rowsWritten ?? 0;
      return acc;
    },
    { rowReads: 0, rowWrites: 0 }
  );

  return { ...totals, storageGB: 0 };
}
