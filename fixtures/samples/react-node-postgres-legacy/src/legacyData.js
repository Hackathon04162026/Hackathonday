export const legacyCustomers = [
  {
    id: "C-1001",
    name: "Ava Johnson",
    email: "ava.johnson@example.com",
    phone: "+1-555-0199",
    ssnHint: "XXX-XX-4821",
    region: "US",
    status: "manual-review"
  },
  {
    id: "C-2002",
    name: "Noah Patel",
    email: "noah.patel@example.com",
    phone: "+1-555-0104",
    ssnHint: "XXX-XX-1178",
    region: "EU",
    status: "privacy-review"
  },
  {
    id: "C-3003",
    name: "Mia Chen",
    email: "mia.chen@example.com",
    phone: "+1-555-0182",
    ssnHint: "XXX-XX-8991",
    region: "APAC",
    status: "approved"
  }
];

export function summarizeLegacyRow(row) {
  if (!row) return "missing";
  if (row.flagged) return "manual-review";
  if (row.total > 15000) return "executive-review";
  if (row.total > 9000) return "team-review";
  return "approved";
}
