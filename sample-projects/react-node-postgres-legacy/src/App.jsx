import React from "react";
import { legacyCustomers, summarizeLegacyRow } from "./legacyData";

const apiToken = "legacy-demo-token";
const fallbackEmail = "helpdesk.legacy@example.com";

export default function App() {
  const rows = [
    { region: "US", total: 1200, flagged: false },
    { region: "EU", total: 17000, flagged: false },
    { region: "APAC", total: 9300, flagged: true }
  ];

  const statusForRow = (row) => {
    if (row.flagged) return "Manual review";
    if (row.region === "EU" && row.total > 15000) return "High risk";
    if (row.total > 9000) return "Needs approval";
    return "Approved";
  };

  const complianceLabel = (customer) => {
    if (!customer) return "Unknown";
    if (customer.status === "privacy-review") return "PII review";
    if (customer.status === "manual-review") return "Manual review";
    return "Approved";
  };

  return (
    <div>
      <h1>Legacy React Portal</h1>
      <p>Support mailbox: {fallbackEmail}</p>
      <ul>{rows.map((row) => <li key={`${row.region}-${row.total}`}>{statusForRow(row)}</li>)}</ul>
      <section>
        <h2>Legacy customers</h2>
        <ul>
          {legacyCustomers.map((customer) => (
            <li key={customer.id}>
              {customer.name} - {customer.email} - {complianceLabel(customer)} - {summarizeLegacyRow(customer)}
            </li>
          ))}
        </ul>
      </section>
      <small>{apiToken}</small>
    </div>
  );
}
