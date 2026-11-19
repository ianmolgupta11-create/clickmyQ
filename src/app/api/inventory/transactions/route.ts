import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import prisma from "../../../../../backend/config/db";
import { z } from "zod";

const INV_WRITE_ROLES = ["HOSPITAL_ADMIN", "FINANCE_HEAD", "SUB_DEPT_HEAD"];
const INV_READ_ROLES = ["HOSPITAL_ADMIN", "FINANCE_HEAD", "SUB_DEPT_HEAD"];

const stockInSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  supplierId: z.string().uuid().optional().nullable(),
  source: z.enum(["PURCHASE", "OPENING_STOCK", "RETURN", "TRANSFER_IN", "ADJUSTMENT"]),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

const stockOutSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  source: z.enum(["CONSUMPTION", "PATIENT_USAGE", "INTERNAL_ISSUE", "DAMAGED", "EXPIRED", "TRANSFER_OUT", "RETURN_OUT", "ADJUSTMENT"]),
  batchId: z.string().uuid().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, INV_WRITE_ROLES);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "in") {
      const data = stockInSchema.parse(body);
      return handleStockIn(data, auth.hospitalId, auth.user.userId);
    } else if (type === "out") {
      const data = stockOutSchema.parse(body);
      return handleStockOut(data, auth.hospitalId, auth.user.userId);
    } else {
      return errorResponse("Invalid type. Use ?type=in or ?type=out", 400);
    }
  } catch (e: any) {
    if (e.name === "ZodError") return errorResponse("Validation failed", 400, e.issues);
    return errorResponse(e.message, 500);
  }
}

async function handleStockIn(data: any, hospitalId: string, userId: string) {
  const { itemId, quantity, batchNumber, expiryDate, purchasePrice, sellingPrice, supplierId, source, referenceId, notes } = data;

  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, hospitalId } });
  if (!item) return errorResponse("Item not found", 404);

  return prisma.$transaction(async (tx) => {
    const batch = await tx.stockBatch.create({
      data: {
        hospitalId,
        itemId,
        batchNumber: batchNumber || `BATCH-${Date.now()}`,
        quantity,
        remainingQty: quantity,
        purchasePrice: purchasePrice || item.purchasePrice,
        sellingPrice: sellingPrice || item.sellingPrice,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        supplierId,
      },
    });

    await tx.stockMovement.create({
      data: {
        hospitalId,
        itemId,
        batchId: batch.id,
        type: "IN",
        quantity,
        source,
        referenceId,
        notes: notes || `${source}: ${quantity} ${item.unit} received`,
        performedBy: userId,
      },
    });

    return successResponse({ batch, movement: { type: "IN", quantity } }, "Stock received");
  });
}

async function handleStockOut(data: any, hospitalId: string, userId: string) {
  const { itemId, quantity, source, batchId, referenceId, notes } = data;

  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, hospitalId } });
  if (!item) return errorResponse("Item not found", 404);

  return prisma.$transaction(async (tx) => {
    let batches;
    if (batchId) {
      const batch = await tx.stockBatch.findFirst({
        where: { id: batchId, hospitalId, itemId, remainingQty: { gte: quantity } },
      });
      if (!batch) return errorResponse("Insufficient stock in batch", 400);
      batches = [batch];
    } else {
      batches = await tx.stockBatch.findMany({
        where: { hospitalId, itemId, remainingQty: { gt: 0 } },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      });
      const totalAvailable = batches.reduce((s, b) => s + b.remainingQty, 0);
      if (totalAvailable < quantity) return errorResponse(`Insufficient stock. Available: ${totalAvailable}`, 400);
    }

    let remainingToDeduct = quantity;
    const movements = [];

    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;
      const deductFromThisBatch = Math.min(batch.remainingQty, remainingToDeduct);

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: { remainingQty: { decrement: deductFromThisBatch } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          hospitalId,
          itemId,
          batchId: batch.id,
          type: "OUT",
          quantity: deductFromThisBatch,
          source,
          referenceId,
          notes: notes || `${source}: ${deductFromThisBatch} ${item.unit} issued`,
          performedBy: userId,
        },
      });
      movements.push(movement);
      remainingToDeduct -= deductFromThisBatch;
    }

    return successResponse({ movements, totalQuantity: quantity }, "Stock issued");
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId") || undefined;
    const type = searchParams.get("type") || undefined;
    const source = searchParams.get("source") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { hospitalId: auth.hospitalId };
    if (itemId) where.itemId = itemId;
    if (type) where.type = type;
    if (source) where.source = source;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, category: true, unit: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return successResponse(
      { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
      "Movements fetched"
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}