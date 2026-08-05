export interface SchoolPayload {
  school: {
    code: string;
    name: string;
    email: string;
    website: string;
    phone?: string;
    address?: string;
    nit?: string;
  };
  admin: {
    fullName: string;
    email: string;
    password: string;
  };
}

export function createSchoolPayload(overrides?: Partial<SchoolPayload>): SchoolPayload {
  const unique = Date.now();

  return {
    school: {
      code: `TEST-${unique}`,
      name: "Colegio Test",
      email: `info${unique}@test.edu`,
      website: "https://test.edu",
      ...overrides?.school,
    },

    admin: {
      fullName: "Administrador Test",
      email: `admin${unique}@test.edu`,
      password: "Temporal123*",
      ...overrides?.admin,
    },
  };
}
