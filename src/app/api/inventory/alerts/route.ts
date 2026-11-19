import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import prisma from "../../../../../backend/config/db";
import { notify } from "../../../../../backend/services/notification.service";

const INV_READ_ROLES = ["HOSPITAL_ADMIN", "FINANCE_HEAD", "SUB_DEPT_HEAD"];

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const hospitalId = auth.hospitalId;

    const [items, expiringSoon, expiring60, expiring30, expired] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { hospitalId, isActive: true },
        include: { batches: { select: { remainingQty: true, expiryDate: true } } },
      }),
      prisma.stockBatch.findMany({
        where: {
          hospitalId,
          remainingQty: { gt: 0 },
          expiryDate: {
            lte: new Date(Date.now() + 90 * 86400000),
            gt: new Date(Date.now() + 60 * 86400000),
          },
        },
        include: { item: { select: { id: true, name: true, category: true, unit: true } } },
        orderBy: { expiryDate: "asc" },
      }),
      prisma.stockBatch.findMany({
        where: {
          hospitalId,
          remainingQty: { gt: 0 },
          expiryDate: {
            lte: new Date(Date.now() + 60 * 86400000),
            gt: new Date(Date.now() + 30 * 86400000),
          },
        },
        include: { item: { select: { id: true, name: true, category: true, unit: true } } },
        orderBy: { expiryDate: "asc" },
      }),
      prisma.stockBatch.findMany({
        where: {
          hospitalId,
          remainingQty: { gt: 0 },
          expiryDate: {
            lte: new Date(Date.now() + 30 * 86400000),
            gt: new Date(),
          },
        },
        include: { item: { select: { id: true, name: true, category: true, unit: true } } },
        orderBy: { expiryDate: "asc" },
      }),
      prisma.stockBatch.findMany({
        where: {
          hospitalId,
          remainingQty: { gt: 0 },
          expiryDate: { lte: new Date() },
        },
        include: { item: { select: { id: true, name: true, category: true, unit: true } } },
        orderBy: { expiryDate: "asc" },
      }),
    ]);

    const lowStock = items
      .map(item => {
        const currentStock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
        const threshold = item.reorderLevel ?? item.minStock;
        return { ...item, currentStock, threshold, batches: undefined };
      })
      .filter(item => item.currentStock > 0 && item.currentStock <= item.threshold)
      .sort((a, b) => a.currentStock - b.currentStock);

    const outOfStock = items
      .map(item => {
        const currentStock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
        return { ...item, currentStock, batches: undefined };
      })
      .filter(item => item.currentStock === 0);

    const formatExpiryAlerts = (batches: any[], label: string) =>
      batches.map(b => ({
        itemId: b.item.id,
        itemName: b.item.name,
        category: b.item.category,
        unit: b.item.unit,
        quantity: b.remainingQty,
        expiryDate: b.expiryDate,
        label,
      }));

    const alerts = {
      lowStock: lowStock.map(item => ({
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: item.currentStock,
        threshold: item.threshold,
        label: "Low Stock",
        severity: item.currentStock === 0 ? "critical" : "warning",
      })),
      outOfStock: outOfStock.map(item => ({
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: 0,
        label: "Out of Stock",
        severity: "critical",
      })),
      expiring90: formatExpiryAlerts(expiringSoon, "Expiring in 90 days"),
      expiring60: formatExpiryAlerts(expiring60, "Expiring in 60 days"),
      expiring30: formatExpiryAlerts(expiring30, "Expiring in 30 days"),
      expired: formatExpiryAlerts(expired, "Expired"),
    };

    const totalAlerts = alerts.lowStock.length + alerts.outOfStock.length + alerts.expiring90.length + alerts.expiring60.length + alerts.expiring30.length + alerts.expired.length;

    return successResponse(
      { alerts, totalAlerts, summary: { lowStock: alerts.lowStock.length, outOfStock: alerts.outOfStock.length, expiring90: alerts.expiring90.length, expiring60: alerts.expiring60.length, expiring30: alerts.expiring30.length, expired: alerts.expired.length } },
      "Alerts fetched"
    );
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["HOSPITAL_ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const hospitalId = auth.hospitalId;

    if (action === "send-notifications") {
      const items = await prisma.inventoryItem.findMany({
        where: { hospitalId, isActive: true },
        include: { batches: { where: { remainingQty: { gt: 0 } }, select: { remainingQty: true } } },
      });

      const lowStock = items
        .map(item => {
          const currentStock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
          const threshold = item.reorderLevel ?? item.minStock;
          return { ...item, currentStock, threshold };
        })
        .filter(item => item.currentStock <= item.threshold);

      let fired = 0;
      for (const item of lowStock) {
        try {
          const critical = item.currentStock === 0;
          await notify({
            hospitalId,
            type: "LOW_STOCK",
            title: critical ? `Out of Stock: ${item.name}` : `Low Stock Alert: ${item.name}`,
            message: critical
              ? `${item.name} (${item.category}) is completely out of stock. Immediate reorder required.`
              : `${item.name} (${item.category}) has only ${item.currentStock} ${item.unit} remaining (threshold: ${item.threshold}).${item.reorderQty ? ` Suggested reorder qty: ${item.reorderQty}.` : ""}`,
            targetRole: "HOSPITAL_ADMIN",
            metadata: {
              itemId: item.id,
              itemName: item.name,
              category: item.category,
              currentStock: item.currentStock,
              threshold: item.threshold,
              unit: item.unit,
            },
          });
          fired++;
        } catch { /* continue */ }
      }

      return successResponse({ fired, total: lowStock.length }, `Sent ${fired} notification(s)`);
    }

    return errorResponse("Invalid action", 400);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}