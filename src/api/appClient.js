// @ts-nocheck

import { apiFetch } from "./config";

const STORAGE_KEY = "guard_sight_safe_local_db_v1";

const defaultDb = {
  Worker: [],
  EntryPoint: [],
  Incident: [],
};

function cloneDefaultDb() {
  return JSON.parse(JSON.stringify(defaultDb));
}

function readDb() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return cloneDefaultDb();
    }

    return {
      ...cloneDefaultDb(),
      ...JSON.parse(raw),
    };
  } catch {
    return cloneDefaultDb();
  }
}

function writeDb(db) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function cacheRecords(entityName, records) {
  const db = readDb();
  db[entityName] = records;
  writeDb(db);
  return records;
}

function sortRecords(records, orderBy) {
  if (!orderBy) {
    return records;
  }

  const desc = orderBy.startsWith("-");
  const field = desc ? orderBy.slice(1) : orderBy;

  return [...records].sort((a, b) => {
    const av = a?.[field] ?? "";
    const bv = b?.[field] ?? "";

    if (av < bv) {
      return desc ? 1 : -1;
    }

    if (av > bv) {
      return desc ? -1 : 1;
    }

    return 0;
  });
}

function mapWorker(worker) {
  return {
    compliance_rate: 100,
    total_violations: 0,
    total_scans: 0,
    ...worker,
    backend_worker_id: worker.id,
  };
}

async function migrateCachedRecords(entityName, listPath, createPath, collectionKey) {
  const cached = readDb()[entityName] || [];

  for (const item of cached) {
    try {
      await apiFetch(createPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    } catch {
      // Already on the server, or the record is not worth migrating.
    }
  }

  const refreshed = await apiFetch(listPath);
  return refreshed[collectionKey] || cached;
}

function jsonEntityApi(entityName, collectionKey, basePath) {
  return {
    async list(orderBy, limit) {
      try {
        const body = await apiFetch(basePath);
        let records = body[collectionKey] || [];

        if (records.length === 0 && (readDb()[entityName] || []).length > 0) {
          records = await migrateCachedRecords(
            entityName,
            basePath,
            basePath,
            collectionKey,
          );
        }

        cacheRecords(entityName, records);
        records = sortRecords(records, orderBy);

        if (typeof limit === "number") {
          records = records.slice(0, limit);
        }

        return records;
      } catch (error) {
        const cached = sortRecords(readDb()[entityName] || [], orderBy);
        if (cached.length) {
          return typeof limit === "number" ? cached.slice(0, limit) : cached;
        }
        throw error;
      }
    },

    async create(data) {
      const body = await apiFetch(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const record = body[entityName.toLowerCase()] || body.entry_point || body.incident;
      const db = readDb();
      db[entityName] = [record, ...(db[entityName] || [])];
      writeDb(db);
      return record;
    },

    async update(id, data) {
      const body = await apiFetch(`${basePath}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const record = body[entityName.toLowerCase()] || body.entry_point || body.incident;
      const db = readDb();
      const recordId = String(id ?? "").trim();
      db[entityName] = (db[entityName] || []).map((item) =>
        String(item?.id) === recordId ? record : item,
      );
      writeDb(db);
      return record;
    },

    async delete(id) {
      const recordId = String(id ?? "").trim();
      if (!recordId || recordId === "undefined" || recordId === "null") {
        throw new Error("A valid record ID is required to delete.");
      }

      await apiFetch(`${basePath}/${encodeURIComponent(recordId)}`, { method: "DELETE" });
      const db = readDb();
      db[entityName] = (db[entityName] || []).filter(
        (item) => item != null && String(item.id) !== recordId,
      );
      writeDb(db);
      return { success: true };
    },
  };
}

function buildWorkerFormData(data, includePhoto) {
  const formData = new FormData();

  formData.append("full_name", data.full_name || "");
  formData.append("employee_id", data.employee_id || "");
  formData.append("department", data.department || "");
  formData.append("status", data.status || "active");
  formData.append("required_gear", JSON.stringify(data.required_gear || []));

  if (includePhoto && data.photo_file) {
    formData.append("photo", data.photo_file);
  }

  return formData;
}

const workerApi = {
  async list(orderBy, limit) {
    try {
      const body = await apiFetch("/api/workers");
      let records = (body.workers || []).map(mapWorker);
      cacheRecords("Worker", records);
      records = sortRecords(records, orderBy);

      if (typeof limit === "number") {
        records = records.slice(0, limit);
      }

      return records;
    } catch (error) {
      const cached = sortRecords(readDb().Worker || [], orderBy);
      if (cached.length) {
        return typeof limit === "number" ? cached.slice(0, limit) : cached;
      }
      throw error;
    }
  },

  async create(data) {
    const body = await apiFetch("/api/workers", {
      method: "POST",
      body: buildWorkerFormData(data, true),
    });

    const record = mapWorker(body.worker);
    const db = readDb();
    db.Worker = [record, ...(db.Worker || [])];
    writeDb(db);
    return record;
  },

  async update(id, data) {
    const isProfileUpdate = Boolean(data.full_name || data.employee_id || data.photo_file);
    const body = isProfileUpdate
      ? await apiFetch(`/api/workers/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: buildWorkerFormData(data, Boolean(data.photo_file)),
        })
      : await apiFetch(`/api/workers/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

    const record = mapWorker(body.worker);
    const db = readDb();
    const recordId = String(id ?? "").trim();
    db.Worker = (db.Worker || []).map((item) =>
      String(item?.id) === recordId ? record : item,
    );
    writeDb(db);
    return record;
  },

  async delete(id) {
    const recordId = String(id ?? "").trim();
    if (!recordId || recordId === "undefined" || recordId === "null") {
      throw new Error("A valid record ID is required to delete.");
    }

    await apiFetch(`/api/workers/${encodeURIComponent(recordId)}`, { method: "DELETE" });
    const db = readDb();
    db.Worker = (db.Worker || []).filter((item) => String(item?.id) !== recordId);
    writeDb(db);
    return { success: true };
  },
};

export const appClient = {
  auth: {
    async me() {
      return {
        id: "local-admin",
        full_name: "Local Admin",
        email: "local@aisafeguard.app",
        role: "admin",
      };
    },

    logout() {},

    redirectToLogin() {},
  },

  entities: {
    Worker: workerApi,
    EntryPoint: jsonEntityApi("EntryPoint", "entry_points", "/api/entry-points"),
    Incident: jsonEntityApi("Incident", "incidents", "/api/incidents"),
  },
};

export default appClient;
