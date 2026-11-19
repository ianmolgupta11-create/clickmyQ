import { NextRequest } from "next/server";
import { requireRole } from "../../../../../backend/middlewares/role.middleware";
import { successResponse, errorResponse } from "../../../../../backend/utils/response";
import prisma from "../../../../../backend/config/db";

const INV_READ_ROLES = ["HOSPITAL_ADMIN", "FINANCE_HEAD", "SUB_DEPT_HEAD"];

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, INV_READ_ROLES);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const hospitalId = auth.hospitalId;
    const reportType = searchParams.get("type") || "stock";
    const format = searchParams.get("format") || "json";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (reportType === "stock") {
      return generateStockReport(hospitalId, format, startDate, endDate);
    } else if (reportType === "movement") {
      return generateMovementReport(hospitalId, format, startDate, endDate);
    } else if (reportType === "purchase") {
      return generatePurchaseReport(hospitalId, format, startDate, endDate);
    } else if (reportType === "valuation") {
      return generateValuationReport(hospitalId, format);
    } else if (reportType === "expiry") {
      return generateExpiryReport(hospitalId, format);
    } else if (reportType === "low-stock") {
      return generateLowStockReport(hospitalId, format);
    }

    return errorResponse("Invalid report type", 400);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

async function generateStockReport(hospitalId: string, format: string, startDate: string | null, endDate: string | null) {
  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, isActive: true },
    include: {
      batches: { select: { remainingQty: true, purchasePrice: true, sellingPrice: true, expiryDate: true, batchNumber: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = items.map(item => {
    const totalStock = item.batches.reduce((s: number, b: { remainingQty: number }) => s + b.remainingQty, 0);
    const stockValue = item.batches.reduce((s: number, b: { remainingQty: number; purchasePrice: number }) => s + b.remainingQty * b.purchasePrice, 0);
    const retailValue = item.batches.reduce((s: number, b: { remainingQty: number; sellingPrice: number | null }) => s + b.remainingQty * (b.sellingPrice || item.sellingPrice || item.mrp), 0);
    const nearestExpiry = item.batches[0]?.expiryDate || null;
    const status = totalStock === 0 ? "Out of Stock" : totalStock <= item.minStock ? "Low Stock" : "In Stock";

    return {
      "Item Name": item.name,
      "SKU": item.sku || "",
      "Category": item.category,
      "Sub Category": item.subCategory || "",
      "Unit": item.unit,
      "Available Stock": totalStock,
      "Min Stock": item.minStock,
      "Max Stock": item.maxStock || "",
      "Purchase Price": item.purchasePrice,
      "Selling Price": item.sellingPrice,
      "MRP": item.mrp,
      "Stock Value (Cost)": stockValue.toFixed(2),
      "Stock Value (Retail)": retailValue.toFixed(2),
      "Supplier": "",
      "Nearest Expiry": nearestExpiry ? new Date(nearestExpiry).toLocaleDateString() : "",
      "Status": status,
      "Location": item.location || "",
      "Rack": item.rackNumber || "",
    };
  });

  if (format === "csv") {
    return new Response(generateCSV(data), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="stock-report-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return successResponse({ data }, "Stock report generated");
}

async function generateMovementReport(hospitalId: string, format: string, startDate: string | null, endDate: string | null) {
  const where: any = { hospitalId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      item: { select: { name: true, category: true, unit: true, sku: true } },
      batch: { select: { batchNumber: true, expiryDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = movements.map(m => ({
    "Date": new Date(m.createdAt).toLocaleDateString(),
    "Time": new Date(m.createdAt).toLocaleTimeString(),
    "Item": m.item.name,
    "SKU": m.item.sku || "",
    "Category": m.item.category,
    "Type": m.type,
    "Source": m.source,
    "Quantity": m.quantity,
    "Unit": m.item.unit,
    "Batch": m.batch?.batchNumber || "",
    "Expiry": m.batch?.expiryDate ? new Date(m.batch.expiryDate).toLocaleDateString() : "",
    "Reference": m.referenceId || "",
    "Notes": m.notes || "",
  }));

  if (format === "csv") {
    return new Response(generateCSV(data), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="movement-report-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return successResponse({ data }, "Movement report generated");
}

async function generatePurchaseReport(hospitalId: string, format: string, startDate: string | null, endDate: string | null) {
  const where: any = { hospitalId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const purchases = await prisma.purchase.findMany({
    where,
    include: {
      supplier: { select: { name: true, gstNumber: true } },
      items: {
        include: {
          item: { select: { name: true, category: true, unit: true, sku: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = purchases.flatMap(p =>
    p.items.map(i => ({
      "PO Number": p.purchaseNo,
      "PO Date": new Date(p.createdAt).toLocaleDateString(),
      "Supplier": p.supplier?.name || "",
      "Supplier GST": p.supplier?.gstNumber || "",
      "Item": i.item.name,
      "SKU": i.item.sku || "",
      "Category": i.item.category,
      "Quantity": i.quantity,
      "Unit": i.item.unit,
      "Unit Price": i.price,
      "Total": (i.quantity * i.price).toFixed(2),
      "Batch": i.batchNumber || "",
      "Expiry": i.expiryDate ? new Date(i.expiryDate).toLocaleDateString() : "",
      "Status": p.status,
      "Payment Status": p.paymentStatus,
    }))
  );

  if (format === "csv") {
    return new Response(generateCSV(data), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="purchase-report-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return successResponse({ data }, "Purchase report generated");
}

async function generateValuationReport(hospitalId: string, format: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, isActive: true },
    include: { batches: { select: { remainingQty: true, purchasePrice: true, sellingPrice: true, expiryDate: true } } },
  });

  const data = items.map(item => {
    const totalStock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
    const costValue = item.batches.reduce((s, b) => s + b.remainingQty * b.purchasePrice, 0);
    const retailValue = item.batches.reduce((s, b) => s + b.remainingQty * (b.sellingPrice || item.sellingPrice || item.mrp), 0);

    return {
      "Item Name": item.name,
      "Category": item.category,
      "Unit": item.unit,
      "Total Stock": totalStock,
      "Avg Purchase Price": totalStock > 0 ? (costValue / totalStock).toFixed(2) : "0",
      "Avg Selling Price": totalStock > 0 ? (retailValue / totalStock).toFixed(2) : "0",
      "Total Cost Value": costValue.toFixed(2),
      "Total Retail Value": retailValue.toFixed(2),
      "Potential Profit": (retailValue - costValue).toFixed(2),
    };
  });

  const summary = {
    totalItems: items.length,
    totalCostValue: data.reduce((s, d) => s + parseFloat(d["Total Cost Value"]), 0).toFixed(2),
    totalRetailValue: data.reduce((s, d) => s + parseFloat(d["Total Retail Value"]), 0).toFixed(2),
    totalPotentialProfit: data.reduce((s, d) => s + parseFloat(d["Potential Profit"]), 0).toFixed(2),
  };

  if (format === "csv") {
    return new Response(generateCSV([...data, {}, summary]), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="valuation-report-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return successResponse({ data, summary }, "Valuation report generated");
}

async function generateExpiryReport(hospitalId: string, format: string) {
  const batches = await prisma.stockBatch.findMany({
    where: { hospitalId, remainingQty: { gt: 0 } },
    include: { item: { select: { name: true, category: true, unit: true, sku: true } } },
    orderBy: { expiryDate: "asc" },
  });

  const now = new Date();
  const data = batches.map(b => {
    const daysToExpiry = b.expiryDate ? Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / 86400000) : null;
    let status = "Valid";
    if (daysToExpiry !== null) {
      if (daysToExpiry < 0) status = "Expired";
      else if (daysToExpiry <= 30) status = "Expiring Soon (≤30 days)";
      else if (daysToExpiry <= 60) status = "Expiring (≤60 days)";
      else if (daysToExpiry <= 90) status = "Expiring (≤90 days)";
    }

    return {
      "Item": b.item.name,
      "SKU": b.item.sku || "",
      "Category": b.item.category,
      "Batch Number": b.batchNumber || "",
      "Expiry Date": b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "N/A",
      "Days to Expiry": daysToExpiry ?? "N/A",
      "Quantity": b.remainingQty,
      "Unit": b.item.unit,
      "Status": status,
    };
  });

  if (format === "csv") {
    return new Response(generateCSV(data), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expiry-report-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return successResponse({ data }, "Expiry report generated");
}

async function generateLowStockReport(hospitalId: string, format: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, isActive: true },
    include: { batches: { where: { remainingQty: { gt: 0 } }, select: { remainingQty: true } } },
  });

  const data = items
    .map(item => {
      const currentStock = item.batches.reduce((s, b) => s + b.remainingQty, 0);
      const threshold = item.reorderLevel ?? item.minStock;
      return { ...item, currentStock, threshold };
    })
    .filter(item => item.currentStock <= item.threshold)
    .sort((a, b) => a.currentStock - b.currentStock)
    .map(item => ({
      "Item Name": item.name,
      "SKU": item.sku || "",
      "Category": item.category,
      "Unit": item.unit,
      "Current Stock": item.currentStock,
      "Min Stock": item.minStock,
      "Reorder Level": item.reorderLevel || "",
      "Reorder Qty": item.reorderQty || "",
      "Status": item.currentStock === 0 ? "Out of Stock" : "Low Stock",
      "Supplier": item.preferredVendorId ? "Linked" : "Not Linked",
    }));

  if (format === "csv") {
    return new Response(generateCSV(data), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="low-stock-report-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return successResponse({ data }, "Low stock report generated");
}

function generateCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => headers.map(h => {
    const val = obj[h];
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(","));
  return [headers.join(","), ...rows].join("\n");
}