import fs from "node:fs/promises";
import path from "node:path";

export type BrandingSettings = {
  promotionRulesHistory: Array<{
    id: string;
    changedAt: string;
    changedById: string;
    changedByName: string;
    restoredFromId?: string;
    previous: {
      minAverage: number;
      maxFailedSubjects: number;
    };
    next: {
      minAverage: number;
      maxFailedSubjects: number;
    };
  }>;
  schoolName: string;
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  promotionRules: {
    minAverage: number;
    maxFailedSubjects: number;
  };
};

const DEFAULT_SETTINGS: BrandingSettings = {
  promotionRulesHistory: [],
  schoolName: process.env.SCHOOL_NAME || "School Platform",
  logoDataUrl: null,
  primaryColor: "#1e3a8a",
  secondaryColor: "#0ea5e9",
  accentColor: "#f59e0b",
  footerText: "Comprometidos con la excelencia academica y formacion integral.",
  promotionRules: {
    minAverage: 60,
    maxFailedSubjects: 2
  }
};

const BRANDING_DIR = path.resolve(process.cwd(), ".runtime");
const BRANDING_FILE = path.join(BRANDING_DIR, "branding-settings.json");

async function ensureDir() {
  await fs.mkdir(BRANDING_DIR, { recursive: true });
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const raw = await fs.readFile(BRANDING_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<BrandingSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      schoolName: parsed.schoolName?.trim() || DEFAULT_SETTINGS.schoolName,
      promotionRules: {
        minAverage: Number((parsed as any)?.promotionRules?.minAverage ?? DEFAULT_SETTINGS.promotionRules.minAverage),
        maxFailedSubjects: Number((parsed as any)?.promotionRules?.maxFailedSubjects ?? DEFAULT_SETTINGS.promotionRules.maxFailedSubjects)
      },
      promotionRulesHistory: Array.isArray((parsed as any)?.promotionRulesHistory)
        ? ((parsed as any).promotionRulesHistory as BrandingSettings["promotionRulesHistory"])
        : []
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveBrandingSettings(settings: Partial<BrandingSettings>) {
  await ensureDir();
  const current = await getBrandingSettings();
  const next: BrandingSettings = {
    ...current,
    ...settings,
    schoolName: (settings.schoolName ?? current.schoolName).trim(),
    logoDataUrl: settings.logoDataUrl === undefined ? current.logoDataUrl : settings.logoDataUrl,
    promotionRules: {
      minAverage: Number((settings as any)?.promotionRules?.minAverage ?? current.promotionRules.minAverage),
      maxFailedSubjects: Number((settings as any)?.promotionRules?.maxFailedSubjects ?? current.promotionRules.maxFailedSubjects)
    },
    promotionRulesHistory: Array.isArray((settings as any)?.promotionRulesHistory)
      ? ((settings as any).promotionRulesHistory as BrandingSettings["promotionRulesHistory"])
      : current.promotionRulesHistory
  };
  await fs.writeFile(BRANDING_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
