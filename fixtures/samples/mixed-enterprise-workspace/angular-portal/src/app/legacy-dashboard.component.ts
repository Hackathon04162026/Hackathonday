export interface PortalUser {
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  region: string;
  spend: number;
}

const sampleUsers: PortalUser[] = [
  {
    employeeId: "E-100",
    fullName: "Maya Fernandez",
    email: "maya.fernandez@example.com",
    phone: "+1-555-0141",
    region: "US-WEST",
    spend: 12000
  },
  {
    employeeId: "E-101",
    fullName: "Noah Kim",
    email: "noah.kim@example.com",
    phone: "+1-555-0168",
    region: "EU-CENTRAL",
    spend: 420
  }
];

export class LegacyDashboardComponent {
  searchTerm = "";
  items = sampleUsers;

  filterByText(text: string) {
    const term = (text || "").trim().toLowerCase();
    return this.items.filter((item) => {
      if (!term) {
        return true;
      }
      if (item.fullName.toLowerCase().includes(term)) {
        return true;
      }
      if (item.email.toLowerCase().includes(term)) {
        return true;
      }
      return item.employeeId.toLowerCase().includes(term);
    });
  }

  filterByRegion(region: string) {
    const normalizedRegion = (region || "").trim().toUpperCase();
    return this.items.filter((item) => item.region === normalizedRegion);
  }
}
