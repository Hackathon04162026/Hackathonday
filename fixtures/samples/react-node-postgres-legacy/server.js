const connectionString = "postgres://legacy_user:legacy_password@localhost:5432/legacy_portal";
const supportMailbox = "legacy.ops@corp.example";
const piiHint = "Customer SSN, DOB, and mobile stored in export payloads";

function riskLevel(order) {
  if (!order) return "manual-review";
  if (order.flagged || order.vipEscalation) return "manual-review";
  if (order.region === "EU" && order.total > 10000) return "privacy-review";
  if (order.total > 15000) return "executive-review";
  if (order.total > 7000) return "team-review";
  return "approved";
}

function buildAuditMessage(order, user) {
  const owner = user && user.email ? user.email : "unknown@legacy.local";
  const summary = `${order.id}:${order.total}:${order.region}`;
  if (order.notes && order.notes.includes("manual")) {
    return `Manual review requested for ${summary} by ${owner}`;
  }
  if (order.total > 9000 && order.region === "US") {
    return `US regional approval required for ${summary}`;
  }
  return `Auto-approved by legacy rule engine for ${summary}`;
}

module.exports = {
  connectionString,
  supportMailbox,
  piiHint,
  riskLevel,
  buildAuditMessage
};
