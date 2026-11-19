import { NextRequest } from "next/server";
import { requireRole } from "../../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../../backend/utils/response";
import prisma from "../../../../../../backend/config/db";
import { z } from "zod";

const INV_READ_ROLES = ["HOSPITAL_ADMIN", "FINANCE_HEAD", "SUB_DEPT_HEAD"];

const itemUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  genericName: z.string().optional().nullable(),
  brandName: z.string().optional().nullable(),
  category: z.enum(["Medicines", "Medical Consumables", "Surgical Supplies", "Laboratory Supplies", "Medical Equipment", "General Supplies"]).optional(),
  subCategory: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.string().optional(),
  packSize: z.string().optional().nullable(),
  conversion: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional().nullable(),
  reorderLevel: z.number().int().min(0).optional().nullable(),
  reorderQty: z.number().int().min(0).optional().nullable(),
  purchasePrice: z.number().min(0).optional(),
  purchaseUnit: z.string().optional().nullable(),
  preferredVendorId: z.string().uuid().optional().nullable(),
  mrp: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  discount: z.number().min(0).max(100).optional(),
  gst: z.number().min(0).max(100).optional(),
  billingType: z.enum(["Tax Inclusive", "Tax Exclusive"]).optional().nullable(),
  location: z.string().optional().nullable(),
  rackNumber: z.string().optional().nullable(),
  tempRequirement: z.string().optional().nullable(),
  drugSchedule: z.string().optional().nullable(),
  requiresRx: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isReturnable: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  image: z.string().optional().nullable(),
  attachments: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const hospitalId = auth.hospitalId;

    const item = await prisma.inventoryItem.findFirst({
      where: { id, hospitalId },
      include: {
        batches: {
          where: { remainingQty: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        },
        movements: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { batch: { select: { batchNumber: true } } },
        },
      },
    });

    if (!item) return errorResponse("Item not found", 404);

    const totalStock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
    const stockValue = totalStock * item.purchasePrice;
    const retailValue = totalStock * (item.sellingPrice || item.mrp);

    const status = totalStock === 0 ? "out-of-stock" : totalStock <= item.minStock ? "low-stock" : "in-stock";

    return successResponse(
      {
        ...item,
        totalStock,
        stockValue,
        retailValue,
        status,
      },
      "Item fetched"
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const hospitalId = auth.hospitalId;

    const body = await req.json();
    const data = itemUpdateSchema.parse(body);

    const existing = await prisma.inventoryItem.findFirst({ where: { id, hospitalId } });
    if (!existing) return errorResponse("Item not found", 404);

    const updated = await prisma.inventoryItem.update({
      where: { id, hospitalId },
      data,
    });

    return successResponse(updated, "Item updated");
  } catch (e: any) {
    if (e.code === "P2002") return errorResponse("Item with same name & category already exists", 409);
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["HOSPITAL_ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const hospitalId = auth.hospitalId;

    const existing = await prisma.inventoryItem.findFirst({ where: { id, hospitalId } });
    if (!existing) return errorResponse("Item not found", 404);

    const hasMovements = await prisma.stockMovement.findFirst({ where: { itemId: id } });
    const hasBatches = await prisma.stockBatch.findFirst({ where: { itemId: id } });
    const hasPurchases = await prisma.purchaseItem.findFirst({ where: { itemId: id } });

    if (hasMovements || hasBatches || hasPurchases) {
      await prisma.inventoryItem.update({
        where: { id, hospitalId },
        data: { isActive: false },
      });
      return successResponse({ archived: true }, "Item archived (has transaction history)");
    }

    await prisma.inventoryItem.delete({ where: { id, hospitalId } });
    return successResponse(null, "Item deleted");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}