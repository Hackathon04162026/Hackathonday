import React from "react";

const records = [
  {
    id: "R-310",
    owner: "Maya Fernandez",
    email: "maya.fernandez@example.com",
    risk: "high",
    notes: "Manual approval needed for payroll flow"
  },
  {
    id: "R-311",
    owner: "Noah Kim",
    email: "noah.kim@example.com",
    risk: "medium",
    notes: "Redundant mapping logic in dashboard transformer"
  }
];

function legacySummary(record) {
  if (!record) {
    return "none";
  }
  if (record.risk === "high") {
    return "priority";
  }
  if (record.risk === "medium") {
    return "review";
  }
  return "ok";
}

export default function App() {
  return (
    <main>
      <h1>Legacy Dash</h1>
      <p>Cross-platform demo with reusable onboarding data and risk hints.</p>
      <ul>
        {records.map((record) => (
          <li key={record.id}>
            <strong>{record.owner}</strong> - {record.email} - {legacySummary(record)}
          </li>
        ))}
      </ul>
    </main>
  );
}
