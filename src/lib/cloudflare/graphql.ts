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
  subrequests: number;
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
    subrequests: r.sum.subrequests,
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

  // CF R2 pricing: Class A = mutations; Class B = reads
  // https://developers.cloudflare.com/r2/pricing/
  const CLASS_A_OPS = new Set([
    "PutObject", "DeleteObject", "DeleteObjects", "CopyObject",
    "CompleteMultipartUpload", "CreateMultipartUpload", "UploadPart", "UploadPartCopy",
    "AbortMultipartUpload", "ListObjects", "ListBuckets",
    "PutBucket", "DeleteBucket",
  ]);
  const CLASS_B_OPS = new Set(["GetObject", "HeadObject"]);

  const classAOps =
    acct?.ops
      .filter((r) => CLASS_A_OPS.has(r.dimensions.actionType))
      .reduce((s, r) => s + r.sum.requests, 0) ?? 0;

  const classBOps =
    acct?.ops
      .filter((r) => CLASS_B_OPS.has(r.dimensions.actionType))
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
  readQueries: number;
  writeQueries: number;
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
      acc.readQueries += r.sum.readQueries ?? 0;
      acc.writeQueries += r.sum.writeQueries ?? 0;
      return acc;
    },
    { rowReads: 0, rowWrites: 0, readQueries: 0, writeQueries: 0 }
  );

  return { ...totals, storageGB: 0 };
}

// ─── Queues ──────────────────────────────────────────────────────────────────

export interface QueueUsage {
  queueId: string;
  billableOps: number;
  bytes: number;
  messagesWritten: number;
  messagesRead: number;
  messagesDeleted: number;
}

export async function getQueuesUsage(
  token: string,
  accountId: string,
  start: string,
  end: string
): Promise<QueueUsage[]> {
  const query = `
    query QueuesUsage($accountId: String!, $start: String!, $end: String!) {
      viewer {
        accounts(filter: { accountTag: $accountId }) {
          queueMessageOperationsAdaptiveGroups(
            limit: 10000
            filter: { datetime_geq: $start, datetime_leq: $end }
          ) {
            sum { billableOperations bytes }
            dimensions { queueId actionType }
          }
        }
      }
    }
  `;

  interface Row {
    sum: { billableOperations: number; bytes: number };
    dimensions: { queueId: string; actionType: string };
  }
  interface GqlResult {
    viewer: { accounts: { queueMessageOperationsAdaptiveGroups: Row[] }[] };
  }

  const data = await gql<GqlResult>(token, query, { accountId, start, end });
  const rows = data.viewer.accounts[0]?.queueMessageOperationsAdaptiveGroups ?? [];

  // Aggregate per queue
  const byQueue = new Map<string, QueueUsage>();
  for (const r of rows) {
    const qId = r.dimensions.queueId;
    if (!byQueue.has(qId)) {
      byQueue.set(qId, { queueId: qId, billableOps: 0, bytes: 0, messagesWritten: 0, messagesRead: 0, messagesDeleted: 0 });
    }
    const q = byQueue.get(qId)!;
    q.billableOps += r.sum.billableOperations ?? 0;
    q.bytes += r.sum.bytes ?? 0;
    if (r.dimensions.actionType === "WriteMessage") q.messagesWritten += r.sum.billableOperations ?? 0;
    if (r.dimensions.actionType === "ReadMessage")  q.messagesRead    += r.sum.billableOperations ?? 0;
    if (r.dimensions.actionType === "DeleteMessage") q.messagesDeleted += r.sum.billableOperations ?? 0;
  }

  return Array.from(byQueue.values());
}
