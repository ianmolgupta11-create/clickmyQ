import prisma from "../config/db";

export interface PrescriptionMedicineInput {
  medicineId?: string;
  name?: string;
  genericName?: string;
  strength?: string;
  dosage?: string;
  dosageForm?: string;
  route?: string;
}

export function normalizeMedicinePart(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getStrength(medicine: PrescriptionMedicineInput): string {
  const explicitStrength = String(medicine.strength || "").trim();
  if (explicitStrength) return explicitStrength;

  // The prescription dosage may be an administration instruction such as
  // "1 tablet". Only promote a dosage to medicine strength when it looks like
  // a pharmaceutical strength, otherwise one medicine would be duplicated for
  // every different patient instruction.
  const dosage = String(medicine.dosage || "").trim();
  return /\d\s*(mg|mcg|μg|g|kg|ml|l|iu|units?|%)(?:\b|\/)/i.test(dosage) ? dosage : "";
}

function getNormalizedKey(name: string, strength: string): string {
  const normalizedName = normalizeMedicinePart(name);
  const normalizedStrength = normalizeMedicinePart(strength);
  if (!normalizedStrength || normalizedName.includes(normalizedStrength)) return normalizedName;
  return `${normalizedName} ${normalizedStrength}`.trim();
}

function clean(value: unknown, maxLength = 191): string | null {
  const result = String(value || "").trim();
  return result ? result.slice(0, maxLength) : null;
}

function toLibraryRecord(medicine: PrescriptionMedicineInput) {
  const name = clean(medicine.name);
  if (!name) return null;

  const strength = clean(getStrength(medicine));
  return {
    name,
    normalizedName: getNormalizedKey(name, strength || ""),
    genericName: clean(medicine.genericName),
    strength,
    dosageForm: clean(medicine.dosageForm),
    defaultRoute: clean(medicine.route),
  };
}

/**
 * Learn medicine names from a prescription without making the prescription
 * save dependent on the library. The prescription keeps its own JSON snapshot;
 * this table is only a shared autocomplete/formulary convenience.
 */
export async function learnMedicinesFromPrescription(
  hospitalId: string,
  medicines: unknown,
  addedByDoctorId?: string | null
) {
  if (!hospitalId || !Array.isArray(medicines)) return;

  const unique = new Map<string, ReturnType<typeof toLibraryRecord>>();
  for (const raw of medicines) {
    if (!raw || typeof raw !== "object") continue;
    const record = toLibraryRecord(raw as PrescriptionMedicineInput);
    if (record) unique.set(record.normalizedName, record);
  }

  for (const record of unique.values()) {
    if (!record) continue;
    await prisma.hospitalMedicine.upsert({
      where: {
        hospitalId_normalizedName: {
          hospitalId,
          normalizedName: record.normalizedName,
        },
      },
      create: {
        hospitalId,
        ...record,
        usageCount: 1,
        lastUsedAt: new Date(),
        addedByDoctorId: addedByDoctorId || null,
      },
      update: {
        name: record.name,
        genericName: record.genericName,
        strength: record.strength,
        dosageForm: record.dosageForm,
        defaultRoute: record.defaultRoute,
        isActive: true,
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        ...(addedByDoctorId ? { addedByDoctorId } : {}),
      },
    });
  }
}

export async function searchHospitalMedicines(hospitalId: string, query: string, limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const q = query.trim();

  const where = q ? {
    hospitalId,
    isActive: true,
    OR: [
      { name: { contains: q } },
      { normalizedName: { contains: normalizeMedicinePart(q) } },
      { genericName: { contains: q } },
      { strength: { contains: q } },
      { dosageForm: { contains: q } },
    ],
  } : { hospitalId, isActive: true };

  const items = await prisma.hospitalMedicine.findMany({
    where,
    orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }, { name: "asc" }],
    take: safeLimit,
    select: {
      id: true,
      name: true,
      genericName: true,
      strength: true,
      dosageForm: true,
      defaultRoute: true,
      usageCount: true,
      lastUsedAt: true,
    },
  });

  return items.map(item => ({
    ...item,
    displayName: [item.name, item.strength].filter(Boolean).join(" "),
  }));
}
