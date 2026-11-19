import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import prisma from "../../../../../backend/config/db";

const INV_READ_ROLES = ["HOSPITAL_ADMIN", "FINANCE_HEAD", "SUB_DEPT_HEAD"];

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const hospitalId = auth.hospitalId;

    const [items, batches, suppliers, movements, expiringBatches, expiredBatches] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { hospitalId, isActive: true },
        include: { batches: { select: { remainingQty: true, purchasePrice: true, sellingPrice: true, expiryDate: true } } },
      }),
      prisma.stockBatch.findMany({
        where: { hospitalId, remainingQty: { gt: 0 } },
        select: { remainingQty: true, purchasePrice: true, sellingPrice: true, expiryDate: true, itemId: true },
      }),
      prisma.supplier.count({ where: { hospitalId, isActive: true } }),
      prisma.stockMovement.findMany({
        where: { hospitalId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.stockBatch.findMany({
        where: {
          hospitalId,
          remainingQty: { gt: 0 },
          expiryDate: {
            lte: new Date(Date.now() + 90 * 86400000),
            gt: new Date(),
          },
        },
        select: { itemId: true, remainingQty: true, expiryDate: true },
      }),
      prisma.stockBatch.findMany({
        where: {
          hospitalId,
          remainingQty: { gt: 0 },
          expiryDate: { lte: new Date() },
        },
        select: { itemId: true, remainingQty: true, expiryDate: true },
      }),
    ]);

    const totalItems = items.length;
    const totalStockValue = items.reduce((sum, item) => {
      const stock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
      return sum + stock * item.purchasePrice;
    }, 0);

    const lowStockCount = items.filter(item => {
      const stock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
      return stock <= item.minStock;
    }).length;

    const outOfStockCount = items.filter(item => {
      const stock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
      return stock === 0;
    }).length;

    const expiringSoonCount = expiringBatches.length;
    const expiredCount = expiredBatches.length;

    const categoryMap: Record<string, { count: number; value: number; stock: number }> = {};
    for (const item of items) {
      if (!categoryMap[item.category]) categoryMap[item.category] = { count: 0, value: 0, stock: 0 };
      const stock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
      categoryMap[item.category].count++;
      categoryMap[item.category].value += stock * item.purchasePrice;
      categoryMap[item.category].stock += stock;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const monthlyStockIn = movements
      .filter((m: any) => ["IN", "PURCHASE", "OPENING_STOCK", "TRANSFER_IN", "RETURN_IN"].includes(m.type) && new Date(m.createdAt) >= thirtyDaysAgo)
      .reduce((s: number, m: any) => s + m.quantity, 0);

    const monthlyStockOut = movements
      .filter((m: any) => ["OUT", "CONSUMPTION", "TRANSFER_OUT", "RETURN_OUT", "DAMAGED", "EXPIRED"].includes(m.type) && new Date(m.createdAt) >= thirtyDaysAgo)
      .reduce((s: number, m: any) => s + m.quantity, 0);

    const recentMovements = movements.slice(0, 10).map((m: any) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      source: m.source,
      notes: m.notes,
      createdAt: m.createdAt,
    }));

    return successResponse(
      {
        totalItems,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
        expiringSoonCount,
        expiredCount,
        totalSuppliers: suppliers,
        monthlyStockIn,
        monthlyStockOut,
        categories: Object.entries(categoryMap).map(([name, data]) => ({ name, ...data })),
        recentMovements,
      },
      "Dashboard stats fetched"
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}