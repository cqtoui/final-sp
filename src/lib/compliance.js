export const VIOLATION_PENALTY = 2;

export function calculateComplianceRate(totalViolations) {
  const normalizedViolations = Math.max(0, Number(totalViolations || 0));
  return Math.max(0, 100 - normalizedViolations * VIOLATION_PENALTY);
}

export function findWorkerForIncident(workers, incident) {
  if (!incident) {
    return null;
  }

  const workerId = String(incident.worker_id || "").trim();
  if (workerId && workerId !== "undefined" && workerId !== "null") {
    const matchedById = (workers || []).find(
      (worker) =>
        String(worker.id) === workerId ||
        String(worker.backend_worker_id) === workerId
    );
    if (matchedById) {
      return matchedById;
    }
  }

  const workerName = String(incident.worker_name || "").trim().toLowerCase();
  if (!workerName || workerName === "unknown worker") {
    return null;
  }

  return (
    (workers || []).find(
      (worker) =>
        String(worker.full_name || "").trim().toLowerCase() === workerName
    ) || null
  );
}
