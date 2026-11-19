import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import prisma from "../../../../../backend/config/db";
import { z } from "zod";

const INV_READ_ROLES = ["HOSPITAL_ADMIN", "FINANCE_HEAD", "SUB_DEPT_HEAD"];

const itemQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  stockStatus: z.enum(["all", "in-stock", "low-stock", "out-of-stock", "expiring", "expired"]).default("all"),
  sortBy: z.enum(["name", "category", "stock", "value", "expiry", "updatedAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const hospitalId = auth.hospitalId;
    const { searchParams } = new URL(req.url);

    const parsed = itemQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      search: searchParams.get("search"),
      category: searchParams.get("category"),
      stockStatus: searchParams.get("stockStatus"),
      sortBy: searchParams.get("sortBy"),
      sortOrder: searchParams.get("sortOrder"),
    });

    if (!parsed.success) {
      return errorResponse("Invalid query parameters", 400, parsed.error.issues);
    }

    const { page, limit, search, category, stockStatus, sortBy, sortOrder } = parsed.data;

    const items = await prisma.inventoryItem.findMany({
      where: {
        hospitalId,
        isActive: true,
        ...(category ? { category } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { genericName: { contains: search } },
            { barcode: { contains: search } },
          ],
        } : {}),
      },
      include: {
        batches: {
          where: { remainingQty: { gt: 0 } },
          select: { remainingQty: true, purchasePrice: true, sellingPrice: true, expiryDate: true, batchNumber: true },
          orderBy: { expiryDate: "asc" },
        },
      },
      orderBy: { [sortBy]: sortOrder },
    });

    let filteredItems = items.map(item => {
      const totalStock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
      const stockValue = totalStock * item.purchasePrice;
      const retailValue = totalStock * (item.sellingPrice || item.mrp);
      const nearestExpiry = item.batches[0]?.expiryDate || null;
      const isExpired = nearestExpiry && new Date(nearestExpiry) <= new Date();
      const isExpiringSoon = nearestExpiry && new Date(nearestExpiry) <= new Date(Date.now() + 90 * 86400000) && new Date(nearestExpiry) > new Date();

      let status = "in-stock";
      if (totalStock === 0) status = "out-of-stock";
      else if (totalStock <= item.minStock) status = "low-stock";
      else if (isExpiringSoon) status = "expiring";
      else if (isExpired) status = "expired";

      return {
        ...item,
        totalStock,
        stockValue,
        retailValue,
        nearestExpiry,
        status,
        batches: undefined,
      };
    });

    if (stockStatus !== "all") {
      filteredItems = filteredItems.filter(item => item.status === stockStatus);
    }

    const total = filteredItems.length;
    const start = (page - 1) * limit;
    const data = filteredItems.slice(start, start + limit);

    const categories = [...new Set(items.map(i => i.category))].sort();

    return successResponse(
      {
        data,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        categories,
      },
      "Items fetched"
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

const itemCreateSchema = z.object({
  name: z.string().min(2),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  category: z.enum(["Medicines", "Medical Consumables", "Surgical Supplies", "Laboratory Supplies", "Medical Equipment", "General Supplies"]),
  subCategory: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().default("pcs"),
  packSize: z.string().optional(),
  conversion: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  hsnCode: z.string().optional(),
  minStock: z.number().int().min(0).default(5),
  maxStock: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  reorderQty: z.number().int().min(0).optional(),
  openingStock: z.number().int().min(0).optional(),
  purchasePrice: z.number().min(0).default(0),
  purchaseUnit: z.string().optional(),
  preferredVendorId: z.string().uuid().optional().nullable(),
  mrp: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  discount: z.number().min(0).max(100).default(0),
  gst: z.number().min(0).max(100).default(0),
  billingType: z.enum(["Tax Inclusive", "Tax Exclusive"]).optional(),
  location: z.string().optional(),
  rackNumber: z.string().optional(),
  tempRequirement: z.string().optional(),
  drugSchedule: z.string().optional(),
  requiresRx: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isReturnable: z.boolean().default(true),
  isCritical: z.boolean().default(false),
  image: z.string().optional(),
  attachments: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { openingStock, ...itemData } = itemCreateSchema.parse(body);

    const data = await prisma.inventoryItem.create({
      data: { ...itemData, hospitalId: auth.hospitalId },
    });

    if (openingStock && openingStock > 0) {
      await prisma.$transaction(async (tx) => {
        const batch = await tx.stockBatch.create({
          data: {
            hospitalId: auth.hospitalId,
            itemId: data.id,
            batchNumber: "OPENING",
            quantity: openingStock,
            remainingQty: openingStock,
            purchasePrice: data.purchasePrice || 0,
            sellingPrice: data.sellingPrice || 0,
          },
        });
        await tx.stockMovement.create({
          data: {
            hospitalId: auth.hospitalId,
            itemId: data.id,
            batchId: batch.id,
            type: "IN",
            quantity: openingStock,
            source: "OpeningStock",
            notes: `Opening stock for ${data.name}`,
            performedBy: auth.user.userId,
          },
        });
      });
    }

    return successResponse(data, "Item created", 201);
  } catch (e: any) {
    if (e.code === "P2002") return errorResponse("Item with same name & category already exists", 409);
    return errorResponse(e.message, 500);
  }
}