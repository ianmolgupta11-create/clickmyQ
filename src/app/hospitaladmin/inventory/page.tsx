"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Truck, FileText,
  Plus, Search, Filter, Download, ChevronDown, ChevronUp, MoreHorizontal,
  Edit, Trash2, Eye, RotateCcw, Bell, Shield, Calendar, X, Check, Loader2,
  ChevronLeft, Settings, BarChart2, Box, Pill, Syringe, Microscope, Cpu, Boxes
} from "lucide-react";

const api = async (url: string, method = "GET", body?: any) => {
  const opts: any = { method, credentials: "include", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
};

const CATEGORIES = ["Medicines", "Medical Consumables", "Surgical Supplies", "Laboratory Supplies", "Medical Equipment", "General Supplies"];
const UNITS = ["pcs", "strip", "box", "bottle", "vial", "ampoule", "tube", "kg", "gm", "ml", "ltr", "pair", "set"];
const STOCK_STATUSES = [
  { value: "all", label: "All Status" },
  { value: "in-stock", label: "In Stock" },
  { value: "low-stock", label: "Low Stock" },
  { value: "out-of-stock", label: "Out of Stock" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];

const categoryIcons: Record<string, any> = {
  Medicines: Pill,
  "Medical Consumables": Syringe,
  "Surgical Supplies": Shield,
  "Laboratory Supplies": Microscope,
  "Medical Equipment": Cpu,
  "General Supplies": Boxes,
};

const INVENTORY_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.inv-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
.inv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
.inv-title { font-size: 22px; font-weight: 800; color: #1e293b; letter-spacing: -0.02em; }
.inv-subtitle { font-size: 12px; color: #94a3b8; margin-top: 2px; }

.inv-tabs { display: flex; gap: 4px; background: #fff; border-radius: 12px; padding: 4px; border: 1px solid #e2e8f0; margin-bottom: 24px; }
.inv-tab { padding: 10px 16px; border-radius: 8px; border: none; background: none; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.inv-tab:hover { background: #f8fafc; color: #334155; }
.inv-tab.active { background: #F0FDFA; color: #0F766E; }

.inv-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); overflow: hidden; }
.inv-card-head { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.inv-card-title { font-size: 14px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 10px; }
.inv-card-body { padding: 24px; }

.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: all 0.2s; }
.stat-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-color: #cbd5e1; }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-content { flex: 1; min-width: 0; }
.stat-value { font-size: 24px; font-weight: 800; color: #1e293b; line-height: 1.2; }
.stat-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
.stat-trend { font-size: 11px; font-weight: 600; margin-top: 8px; display: flex; align-items: center; gap: 4px; }

.search-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 250px; padding: 10px 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #1e293b; outline: none; transition: all 0.2s; }
.search-input:focus { border-color: #14B8A6; background: #fff; box-shadow: 0 0 0 3px rgba(14,137,143,0.08); }
.filter-select { padding: 10px 14px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 12px; color: #1e293b; outline: none; min-width: 160px; cursor: pointer; }
.filter-select:focus { border-color: #14B8A6; box-shadow: 0 0 0 3px rgba(14,137,143,0.08); }

.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; border: none; }
.btn-primary { background: #14B8A6; color: #fff; box-shadow: 0 4px 12px rgba(20,184,166,0.25); }
.btn-primary:hover { background: #0F766E; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.btn-ghost { background: #fff; color: #64748b; border: 1.5px solid #e2e8f0; }
.btn-ghost:hover { background: #f8fafc; color: #1e293b; }
.btn-danger { background: #fff5f5; color: #ef4444; border: 1.5px solid #fecaca; }
.btn-danger:hover { background: #fee2e2; }
.btn-icon { width: 36px; height: 36px; padding: 0; border-radius: 8px; display: flex; align-items: center; justify-content: center; }

.table-wrap { overflow-x: auto; }
.inv-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.inv-table th { text-align: left; font-size: 10px; font-weight: 600; color: #94a3b8; padding: 12px 14px; border-bottom: 2px solid #f1f5f9; white-space: nowrap; cursor: pointer; user-select: none; }
.inv-table th:hover { color: #64748b; background: #fafbfc; }
.inv-table td { padding: 12px 14px; color: #475569; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
.inv-table tbody tr:hover td { background: #fafbfc; }
.inv-table tbody tr:last-child td { border-bottom: none; }

.badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 100px; font-size: 10px; font-weight: 700; }
.category-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 600; background: #F0FDFA; color: #0F766E; }

.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal { background: #fff; border-radius: 16px; width: 100%; max-width: 720px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); animation: slideUp 0.2s ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-lg { max-width: 900px; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
.modal-title { font-size: 16px; font-weight: 800; color: #1e293b; }
.modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: none; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.modal-close:hover { background: #f1f5f9; color: #1e293b; }
.modal-body { padding: 24px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #f1f5f9; background: #fafbfc; border-radius: 0 0 16px 16px; }

.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.form-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
@media (max-width: 768px) { .form-grid, .form-grid-2 { grid-template-columns: 1fr; } }
.form-field { display: flex; flex-direction: column; gap: 5px; }
.form-field.full-width { grid-column: 1 / -1; }
.form-label { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; }
.form-label .required { color: #ef4444; margin-left: 2px; }
.form-input { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px 13px; font-size: 12px; color: #1e293b; outline: none; transition: all 0.2s; width: 100%; }
.form-input:focus { border-color: #14B8A6; background: #fff; box-shadow: 0 0 0 3px rgba(14,137,143,0.08); }
.form-input::placeholder { color: #cbd5e1; }
.form-error { font-size: 11px; color: #ef4444; font-weight: 500; margin-top: 4px; }
.radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
.radio-pill { padding: 8px 16px; border-radius: 8px; border: 1.5px solid #e2e8f0; background: #fff; font-size: 11px; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s; }
.radio-pill.active { border-color: #14B8A6; background: #F0FDFA; color: #0F766E; }
.section-divider { margin: 20px 0; padding-top: 20px; border-top: 1px solid #f1f5f9; }
.section-title { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px; }

.alert-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; align-items: flex-start; gap: 12px; transition: all 0.2s; }
.alert-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.alert-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.alert-content { flex: 1; min-width: 0; }
.alert-title { font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
.alert-meta { font-size: 11px; color: #64748b; display: flex; flex-wrap: wrap; gap: 12px; }
.alert-severity { padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; }

.empty-state { text-align: center; padding: 60px 20px; color: #94a3b8; }
.empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
.empty-state-title { font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 8px; }
.empty-state-desc { font-size: 12px; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px; }
.page-btn { width: 36px; height: 36px; border-radius: 8px; border: 1.5px solid #e2e8f0; background: #fff; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.page-btn:hover:not(:disabled) { border-color: #14B8A6; color: #14B8A6; background: #F0FDFA; }
.page-btn.active { background: #14B8A6; border-color: #14B8A6; color: #fff; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 12px; color: #94a3b8; margin: 0 8px; }

.history-row { display: grid; grid-template-columns: 140px 100px 100px 100px 120px 1fr 120px; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; align-items: center; }
.history-row:last-child { border-bottom: none; }
.history-header { font-weight: 600; color: #94a3b8; font-size: 10px; text-transform: uppercase; background: #fafbfc; }
.history-type { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
.history-type.in { background: #f0fdf4; color: #16a34a; }
.history-type.out { background: #fff5f5; color: #ef4444; }

.supplier-row { display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr 1fr; gap: 16px; padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; align-items: center; }
.supplier-header { font-weight: 600; color: #94a3b8; font-size: 10px; text-transform: uppercase; background: #fafbfc; }

.report-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; color: #475569; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; width: 100%; text-align: left; }
.report-btn:hover { border-color: #14B8A6; color: #14B8A6; background: #F0FDFA; }
.report-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.chart-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 8px; }
.chart-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }

.view-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.view-field { display: flex; flex-direction: column; gap: 4px; }
.view-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
.view-value { font-size: 13px; color: #1e293b; font-weight: 500; }

@media (max-width: 1024px) {
  .inv-page { padding: 16px; }
  .history-row { grid-template-columns: 120px 80px 80px 80px 100px 1fr 100px; font-size: 11px; }
  .supplier-row { grid-template-columns: 2fr 1fr 1fr 1fr; }
}
`;

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"dashboard" | "items" | "suppliers" | "alerts" | "reports">("dashboard");
  const [loading, setLoading] = useState(true);

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // Items state
  const [items, setItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsPagination, setItemsPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [itemsCategories, setItemsCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStockStatus, setSelectedStockStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState<any>({});
  const [itemFormLoading, setItemFormLoading] = useState(false);
  const [itemFormError, setItemFormError] = useState("");

  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalType, setStockModalType] = useState<"in" | "out">("in");
  const [stockItem, setStockItem] = useState<any>(null);
  const [stockForm, setStockForm] = useState({ quantity: "", batchNumber: "", expiryDate: "", purchasePrice: "", sellingPrice: "", supplierId: "", source: "", referenceId: "", notes: "" });
  const [stockFormLoading, setStockFormLoading] = useState(false);
  const [stockFormError, setStockFormError] = useState("");

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);

  // Alerts
  const [alerts, setAlerts] = useState<any>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Suppliers
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierForm, setSupplierForm] = useState<any>({});
  const [supplierFormLoading, setSupplierFormLoading] = useState(false);

  // Reports
  const [reportsLoading, setReportsLoading] = useState(false);

  // Load data
  useEffect(() => {
    loadDashboardStats();
  }, []);

  useEffect(() => {
    if (activeTab === "items") loadItems();
    else if (activeTab === "alerts") loadAlerts();
    else if (activeTab === "suppliers") loadSuppliers();
  }, [activeTab, searchQuery, selectedCategory, selectedStockStatus, sortBy, sortOrder, itemsPagination.page]);

  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      const res = await api("/api/inventory/dashboard");
      if (res.success) setDashboardStats(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadItems = async () => {
    setItemsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(itemsPagination.page),
        limit: String(itemsPagination.limit),
        sortBy,
        sortOrder,
      });
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedStockStatus !== "all") params.set("stockStatus", selectedStockStatus);

      const res = await api(`/api/inventory/items?${params}`);
      if (res.success) {
        setItems(res.data.data);
        setItemsPagination(res.data.pagination);
        setItemsCategories(res.data.categories);
      }
    } catch (e) { console.error(e); }
    finally { setItemsLoading(false); }
  };

  const loadAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await api("/api/inventory/alerts");
      if (res.success) setAlerts(res.data);
    } catch (e) { console.error(e); }
    finally { setAlertsLoading(false); }
  };

  const loadSuppliers = async () => {
    setSuppliersLoading(true);
    try {
      const res = await api("/api/inventory/supplier");
      if (res.success) setSuppliers(res.data);
    } catch (e) { console.error(e); }
    finally { setSuppliersLoading(false); }
  };

  // Item Modal
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({
      name: "", genericName: "", brandName: "", category: "Medicines", subCategory: "",
      description: "", unit: "pcs", packSize: "", conversion: "",
      sku: "", barcode: "", hsnCode: "",
      minStock: 5, maxStock: "", reorderLevel: "", reorderQty: "",
      openingStock: 0,
      purchasePrice: 0, purchaseUnit: "", preferredVendorId: "",
      mrp: 0, sellingPrice: 0, discount: 0, gst: 0, billingType: "Tax Inclusive",
      location: "", rackNumber: "", tempRequirement: "Room Temp",
      drugSchedule: "", requiresRx: false,
      isActive: true, isReturnable: true, isCritical: false,
      image: "", attachments: "",
    });
    setItemFormError("");
    setItemModalOpen(true);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name, genericName: item.genericName || "", brandName: item.brandName || "",
      category: item.category, subCategory: item.subCategory || "",
      description: item.description || "", unit: item.unit, packSize: item.packSize || "", conversion: item.conversion || "",
      sku: item.sku || "", barcode: item.barcode || "", hsnCode: item.hsnCode || "",
      minStock: item.minStock, maxStock: item.maxStock || "", reorderLevel: item.reorderLevel || "", reorderQty: item.reorderQty || "",
      openingStock: 0,
      purchasePrice: item.purchasePrice, purchaseUnit: item.purchaseUnit || "", preferredVendorId: item.preferredVendorId || "",
      mrp: item.mrp, sellingPrice: item.sellingPrice, discount: item.discount, gst: item.gst, billingType: item.billingType || "Tax Inclusive",
      location: item.location || "", rackNumber: item.rackNumber || "", tempRequirement: item.tempRequirement || "Room Temp",
      drugSchedule: item.drugSchedule || "", requiresRx: item.requiresRx,
      isActive: item.isActive, isReturnable: item.isReturnable, isCritical: item.isCritical,
      image: item.image || "", attachments: item.attachments || "",
    });
    setItemFormError("");
    setItemModalOpen(true);
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemFormLoading(true);
    setItemFormError("");
    try {
      const url = editingItem ? `/api/inventory/items/${editingItem.id}` : "/api/inventory/items";
      const method = editingItem ? "PUT" : "POST";
      const res = await api(url, method, itemForm);
      if (res.success) {
        setItemModalOpen(false);
        loadItems();
        if (activeTab === "dashboard") loadDashboardStats();
      } else {
        setItemFormError(res.message || "Failed to save item");
      }
    } catch (e: any) {
      setItemFormError(e.message || "An error occurred");
    } finally {
      setItemFormLoading(false);
    }
  };

  // Stock Modal
  const openStockModal = (type: "in" | "out", item: any) => {
    setStockModalType(type);
    setStockItem(item);
    setStockForm({
      quantity: "",
      batchNumber: type === "in" ? `BATCH-${Date.now()}` : "",
      expiryDate: "",
      purchasePrice: item.purchasePrice || "",
      sellingPrice: item.sellingPrice || item.mrp || "",
      supplierId: "",
      source: type === "in" ? "PURCHASE" : "CONSUMPTION",
      referenceId: "",
      notes: "",
    });
    setStockFormError("");
    setStockModalOpen(true);
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStockFormLoading(true);
    setStockFormError("");
    try {
      const payload = {
        itemId: stockItem.id,
        quantity: parseInt(stockForm.quantity),
        batchNumber: stockForm.batchNumber || undefined,
        expiryDate: stockForm.expiryDate || undefined,
        purchasePrice: stockForm.purchasePrice ? parseFloat(stockForm.purchasePrice) : undefined,
        sellingPrice: stockForm.sellingPrice ? parseFloat(stockForm.sellingPrice) : undefined,
        supplierId: stockForm.supplierId || undefined,
        source: stockForm.source,
        referenceId: stockForm.referenceId || undefined,
        notes: stockForm.notes || undefined,
      };
      const res = await api(`/api/inventory/transactions?type=${stockModalType}`, "POST", payload);
      if (res.success) {
        setStockModalOpen(false);
        loadItems();
        loadDashboardStats();
      } else {
        setStockFormError(res.message || "Failed to process transaction");
      }
    } catch (e: any) {
      setStockFormError(e.message || "An error occurred");
    } finally {
      setStockFormLoading(false);
    }
  };

  // History Modal
  const openHistoryModal = async (item: any) => {
    setHistoryItem(item);
    setHistoryLoading(true);
    try {
      const res = await api(`/api/inventory/transactions?itemId=${item.id}&limit=100`);
      if (res.success) setHistoryData(res.data.data);
    } catch (e) { console.error(e); }
    finally {
      setHistoryLoading(false);
      setHistoryModalOpen(true);
    }
  };

  // View Modal
  const openViewModal = async (item: any) => {
    setViewItem(item);
    setViewModalOpen(true);
  };

  // Delete Item
  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item? Items with transaction history will be archived instead.")) return;
    try {
      const res = await api(`/api/inventory/items/${id}`, "DELETE");
      if (res.success) {
        loadItems();
        loadDashboardStats();
      } else {
        alert(res.message || "Failed to delete item");
      }
    } catch (e) { alert("An error occurred"); }
  };

  // Supplier Modal
  const openAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: "", code: "", contactPerson: "", designation: "",
      phone: "", altPhone: "", email: "",
      address1: "", address2: "", city: "", state: "", pincode: "", country: "India",
      gstNumber: "", panNumber: "", drugLicense: "", fssaiLicense: "",
      bankName: "", accountNumber: "", ifscCode: "", upiId: "",
      paymentTerms: "Immediate", creditLimit: 0, openingBalance: 0,
      preferredPaymentMode: "Bank Transfer", categoriesSupplied: "",
      brandAssociations: "", deliveryLeadTime: 0,
      notes: "", specialInstructions: "",
    });
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (supplier: any) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name, code: supplier.code || "", contactPerson: supplier.contactPerson || "",
      designation: supplier.designation || "", phone: supplier.phone || "", altPhone: supplier.altPhone || "",
      email: supplier.email || "", address1: supplier.address1 || "", address2: supplier.address2 || "",
      city: supplier.city || "", state: supplier.state || "", pincode: supplier.pincode || "",
      country: supplier.country || "India", gstNumber: supplier.gstNumber || "",
      panNumber: supplier.panNumber || "", drugLicense: supplier.drugLicense || "",
      fssaiLicense: supplier.fssaiLicense || "", bankName: supplier.bankName || "",
      accountNumber: supplier.accountNumber || "", ifscCode: supplier.ifscCode || "",
      upiId: supplier.upiId || "", paymentTerms: supplier.paymentTerms || "Immediate",
      creditLimit: supplier.creditLimit || 0, openingBalance: supplier.openingBalance || 0,
      preferredPaymentMode: supplier.preferredPaymentMode || "Bank Transfer",
      categoriesSupplied: supplier.categoriesSupplied || "",
      brandAssociations: supplier.brandAssociations || "",
      deliveryLeadTime: supplier.deliveryLeadTime || 0,
      notes: supplier.notes || "", specialInstructions: supplier.specialInstructions || "",
    });
    setSupplierModalOpen(true);
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierFormLoading(true);
    try {
      const url = editingSupplier ? `/api/inventory/supplier?id=${editingSupplier.id}` : "/api/inventory/supplier";
      const method = editingSupplier ? "PUT" : "POST";
      const res = await api(url, method, supplierForm);
      if (res.success) {
        setSupplierModalOpen(false);
        loadSuppliers();
      } else {
        alert(res.message || "Failed to save supplier");
      }
    } catch (e) { alert("An error occurred"); }
    finally { setSupplierFormLoading(false); }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const res = await api(`/api/inventory/supplier?id=${id}`, "DELETE");
      if (res.success) loadSuppliers();
      else alert(res.message || "Failed to delete supplier");
    } catch (e) { alert("An error occurred"); }
  };

  // Reports Export
  const exportReport = async (type: string) => {
    setReportsLoading(true);
    try {
      const res = await fetch(`/api/inventory/reports?type=${type}&format=csv`, { credentials: "include" });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-report-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) { alert("Failed to export report"); }
    finally { setReportsLoading(false); }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      "in-stock": { label: "In Stock", className: "bg-green-100 text-green-700", icon: Check },
      "low-stock": { label: "Low Stock", className: "bg-amber-100 text-amber-700", icon: AlertTriangle },
      "out-of-stock": { label: "Out of Stock", className: "bg-red-100 text-red-700", icon: X },
      "expiring": { label: "Expiring", className: "bg-orange-100 text-orange-700", icon: Calendar },
      "expired": { label: "Expired", className: "bg-red-100 text-red-700", icon: X },
    };
    return badges[status] || { label: status, className: "bg-gray-100 text-gray-700", icon: Package };
  };

  const getCategoryIcon = (category: string) => {
    const Icon = categoryIcons[category] || Box;
    return <Icon size={14} className="text-teal-600" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-teal-600 animate-spin" />
          <p className="text-gray-500">Loading Inventory Management...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INVENTORY_STYLES }} />
      <div className="inv-page">
        {/* Header */}
        <div className="inv-header">
          <div>
            <h1 className="inv-title">Inventory Management</h1>
            <p className="inv-subtitle">Comprehensive hospital inventory & stock control system</p>
          </div>
          <button className="btn btn-primary" onClick={openAddItem}>
            <Plus size={16} /> Add Item
          </button>
        </div>

        {/* Tabs */}
        <div className="inv-tabs" role="tablist">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart2 },
            { id: "items", label: "Items", icon: Package },
            { id: "suppliers", label: "Suppliers", icon: Truck },
            { id: "alerts", label: "Alerts", icon: Bell },
            { id: "reports", label: "Reports", icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              className={`inv-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id as any)}
              aria-selected={activeTab === tab.id}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && dashboardStats && (
          <>
            {/* Stats Cards */}
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#F0FDFA", color: "#14B8A6" }}>
                  <Package size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.totalItems.toLocaleString()}</div>
                  <div className="stat-label">Total Items</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                  <DollarSign size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">₹{dashboardStats.totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="stat-label">Total Stock Value</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                  <AlertTriangle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.lowStockCount}</div>
                  <div className="stat-label">Low Stock Items</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#fee2e2", color: "#ef4444" }}>
                  <X size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.outOfStockCount}</div>
                  <div className="stat-label">Out of Stock</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#ffedd5", color: "#f97316" }}>
                  <Calendar size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.expiringSoonCount}</div>
                  <div className="stat-label">Expiring Soon (90 days)</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#fee2e2", color: "#ef4444" }}>
                  <X size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.expiredCount}</div>
                  <div className="stat-label">Expired</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#e0e7ff", color: "#6366f1" }}>
                  <Truck size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.totalSuppliers}</div>
                  <div className="stat-label">Total Suppliers</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
                  <TrendingUp size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.monthlyStockIn.toLocaleString()}</div>
                  <div className="stat-label">Stock In (30 days)</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "#fee2e2", color: "#ef4444" }}>
                  <TrendingDown size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{dashboardStats.monthlyStockOut.toLocaleString()}</div>
                  <div className="stat-label">Stock Out (30 days)</div>
                </div>
              </div>
            </div>

            {/* Category Distribution */}
            <div className="inv-card">
              <div className="inv-card-head">
                <div className="inv-card-title">
                  <Box size={18} className="text-teal-600" />
                  Category Distribution
                </div>
              </div>
              <div className="inv-card-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                  {dashboardStats.categories.map((cat: any) => (
                    <div key={cat.name} className="alert-card" style={{ borderColor: "#e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                        <div className="category-badge">
                          {getCategoryIcon(cat.name)}
                          {cat.name}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: "120px" }}>
                        <div className="stat-value" style={{ fontSize: "18px" }}>{cat.count}</div>
                        <div className="stat-label">Items</div>
                        <div className="chart-bar">
                          <div className="chart-bar-fill" style={{ width: `${dashboardStats.totalItems > 0 ? (cat.count / dashboardStats.totalItems) * 100 : 0}%`, background: "#14B8A6" }}></div>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                          ₹{cat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Movements */}
            <div className="inv-card">
              <div className="inv-card-head">
                <div className="inv-card-title">
                  <RotateCcw size={18} className="text-teal-600" />
                  Recent Stock Movements
                </div>
              </div>
              <div className="inv-card-body">
                {dashboardStats.recentMovements.length === 0 ? (
                  <div className="empty-state">
                    <Package className="empty-state-icon" />
                    <div className="empty-state-title">No recent movements</div>
                    <div className="empty-state-desc">Stock transactions will appear here</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="inv-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Source</th>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardStats.recentMovements.map((m: any) => (
                          <tr key={m.id}>
                            <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                            <td><span className={`history-type ${m.type === "IN" ? "in" : "out"}`}>{m.type}</span></td>
                            <td>{m.source}</td>
                            <td style={{ fontWeight: 500 }}>{m.notes?.split(":")[0] || "Item"}</td>
                            <td>{m.quantity}</td>
                            <td className="text-gray-500" style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Items Tab */}
        {activeTab === "items" && (
          <div className="inv-card">
            <div className="inv-card-head">
              <div className="inv-card-title">
                <Package size={18} className="text-teal-600" />
                Inventory Items
                <span style={{ fontSize: "12px", fontWeight: "400", color: "#94a3b8", marginLeft: "8px" }}>
                  {itemsPagination.total} items
                </span>
              </div>
              <button className="btn btn-primary" onClick={openAddItem}>
                <Plus size={16} /> Add Item
              </button>
            </div>

            {/* Search & Filters */}
            <div className="inv-card-body" style={{ paddingTop: 0 }}>
              <div className="search-bar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by name, SKU, generic name, barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadItems()}
                />
                <select className="filter-select" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setItemsPagination(p => ({ ...p, page: 1 })); }}>
                  <option value="">All Categories</option>
                  {itemsCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="filter-select" value={selectedStockStatus} onChange={(e) => { setSelectedStockStatus(e.target.value); setItemsPagination(p => ({ ...p, page: 1 })); }}>
                  {STOCK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button className="btn btn-ghost" onClick={() => { setSearchQuery(""); setSelectedCategory(""); setSelectedStockStatus("all"); }}>
                  <RotateCcw size={16} /> Clear
                </button>
              </div>

              {/* Items Table */}
              <div className="table-wrap">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th onClick={() => { setSortBy("name"); setSortOrder(sortBy === "name" && sortOrder === "asc" ? "desc" : "asc"); }}>
                        Item Name {sortBy === "name" && (sortOrder === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </th>
                      <th>SKU</th>
                      <th onClick={() => { setSortBy("category"); setSortOrder(sortBy === "category" && sortOrder === "asc" ? "desc" : "asc"); }}>
                        Category {sortBy === "category" && (sortOrder === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </th>
                      <th onClick={() => { setSortBy("stock"); setSortOrder(sortBy === "stock" && sortOrder === "asc" ? "desc" : "asc"); }}>
                        Stock {sortBy === "stock" && (sortOrder === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </th>
                      <th>Min Stock</th>
                      <th>Unit</th>
                      <th onClick={() => { setSortBy("value"); setSortOrder(sortBy === "value" && sortOrder === "asc" ? "desc" : "asc"); }}>
                        Value {sortBy === "value" && (sortOrder === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </th>
                      <th>Supplier</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsLoading ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: "40px" }}>
                          <Loader2 size={24} className="animate-spin mx-auto text-teal-600" />
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: "60px 20px" }}>
                          <div className="empty-state">
                            <Package className="empty-state-icon" />
                            <div className="empty-state-title">No items found</div>
                            <div className="empty-state-desc">Add your first inventory item to get started</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item: any) => {
                        const badge = getStatusBadge(item.status);
                        const BadgeIcon = badge.icon;
                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500, maxWidth: "250px" }}>
                              <div style={{ fontWeight: 600 }}>{item.name}</div>
                              {item.genericName && <div style={{ fontSize: "10px", color: "#94a3b8" }}>{item.genericName}</div>}
                              {item.brandName && <div style={{ fontSize: "10px", color: "#94a3b8" }}>{item.brandName}</div>}
                            </td>
                            <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#64748b" }}>{item.sku || "-"}</td>
                            <td>
                              <span className="category-badge">
                                {getCategoryIcon(item.category)}
                                {item.category}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: item.totalStock <= item.minStock ? "#ef4444" : "#10b981" }}>
                              {item.totalStock.toLocaleString()}
                            </td>
                            <td>{item.minStock}</td>
                            <td>{item.unit}</td>
                            <td>₹{item.stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td style={{ color: "#64748b", fontSize: "11px" }}>{item.supplier?.name || "-"}</td>
                            <td style={{ fontSize: "11px", color: item.nearestExpiry ? (new Date(item.nearestExpiry) <= new Date() ? "#ef4444" : new Date(item.nearestExpiry) <= new Date(Date.now() + 30*86400000) ? "#f97316" : "#64748b") : "#94a3b8" }}>
                              {item.nearestExpiry ? new Date(item.nearestExpiry).toLocaleDateString() : "-"}
                            </td>
                            <td>
                              <span className={`badge ${badge.className}`}>
                                <BadgeIcon size={10} /> {badge.label}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button className="btn-icon" onClick={() => openViewModal(item)} title="View">
                                  <Eye size={14} />
                                </button>
                                <button className="btn-icon" onClick={() => openEditItem(item)} title="Edit">
                                  <Edit size={14} />
                                </button>
                                <button className="btn-icon" onClick={() => openStockModal("in", item)} title="Stock In">
                                  <RotateCcw size={14} />
                                </button>
                                <button className="btn-icon" onClick={() => openStockModal("out", item)} title="Stock Out">
                                  <Trash2 size={14} />
                                </button>
                                <button className="btn-icon" onClick={() => openHistoryModal(item)} title="History">
                                  <FileText size={14} />
                                </button>
                                <button className="btn-icon btn-danger" onClick={() => handleDeleteItem(item.id)} title="Delete/Archive">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {itemsPagination.totalPages > 1 && (
                <div className="pagination">
                  <button className="page-btn" onClick={() => setItemsPagination(p => ({ ...p, page: 1 }))} disabled={itemsPagination.page === 1}><ChevronLeft size={14} /></button>
                  <button className="page-btn" onClick={() => setItemsPagination(p => ({ ...p, page: p.page - 1 }))} disabled={itemsPagination.page === 1}><ChevronLeft size={14} /></button>
                  <span className="page-info">Page {itemsPagination.page} of {itemsPagination.totalPages}</span>
                  <button className="page-btn" onClick={() => setItemsPagination(p => ({ ...p, page: p.page + 1 }))} disabled={itemsPagination.page === itemsPagination.totalPages}><ChevronDown size={14} /></button>
                  <button className="page-btn" onClick={() => setItemsPagination(p => ({ ...p, page: p.totalPages }))} disabled={itemsPagination.page === itemsPagination.totalPages}><ChevronDown size={14} /></button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Suppliers Tab */}
        {activeTab === "suppliers" && (
          <div className="inv-card">
            <div className="inv-card-head">
              <div className="inv-card-title">
                <Truck size={18} className="text-teal-600" />
                Suppliers
                <span style={{ fontSize: "12px", fontWeight: "400", color: "#94a3b8", marginLeft: "8px" }}>
                  {suppliers.length} suppliers
                </span>
              </div>
              <button className="btn btn-primary" onClick={openAddSupplier}>
                <Plus size={16} /> Add Supplier
              </button>
            </div>
            <div className="inv-card-body" style={{ paddingTop: 0 }}>
              {suppliersLoading ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <Loader2 size={24} className="animate-spin mx-auto text-teal-600" />
                </div>
              ) : suppliers.length === 0 ? (
                <div className="empty-state">
                  <Truck className="empty-state-icon" />
                  <div className="empty-state-title">No suppliers found</div>
                  <div className="empty-state-desc">Add suppliers to manage procurement</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <div className="supplier-row supplier-header">
                    <div>Supplier</div>
                    <div>Contact</div>
                    <div>Location</div>
                    <div>GST</div>
                    <div>Actions</div>
                  </div>
                  {suppliers.map((s: any) => (
                    <div key={s.id} className="supplier-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        {s.code && <div style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>{s.code}</div>}
                      </div>
                      <div style={{ fontSize: "11px", color: "#475569" }}>
                        {s.contactPerson && <div>{s.contactPerson}</div>}
                        {s.phone && <div>{s.phone}</div>}
                        {s.email && <div>{s.email}</div>}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {s.city && <div>{s.city}</div>}
                        {s.state && <div>{s.state}</div>}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                        {s.gstNumber || "-"}
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn-icon" onClick={() => openEditSupplier(s)} title="Edit"><Edit size={14} /></button>
                        <button className="btn-icon btn-danger" onClick={() => handleDeleteSupplier(s.id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === "alerts" && (
          <div className="inv-card">
            <div className="inv-card-head">
              <div className="inv-card-title">
                <Bell size={18} className="text-teal-600" />
                Smart Alerts
                <span style={{ fontSize: "12px", fontWeight: "400", color: "#94a3b8", marginLeft: "8px" }}>
                  {alerts?.totalAlerts || 0} active alerts
                </span>
              </div>
              <button className="btn btn-primary" onClick={() => api("/api/inventory/alerts?action=send-notifications", "POST").then(loadAlerts)} disabled={alertsLoading}>
                <Bell size={16} /> Send Notifications
              </button>
            </div>
            <div className="inv-card-body" style={{ paddingTop: 0 }}>
              {alertsLoading ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <Loader2 size={24} className="animate-spin mx-auto text-teal-600" />
                </div>
              ) : alerts?.totalAlerts === 0 ? (
                <div className="empty-state">
                  <Shield className="empty-state-icon" style={{ color: "#10b981" }} />
                  <div className="empty-state-title">All Clear!</div>
                  <div className="empty-state-desc">No active alerts at this time</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {[
                    { key: "outOfStock", label: "Out of Stock", color: "#ef4444", bg: "#fee2e2", icon: X },
                    { key: "lowStock", label: "Low Stock", color: "#d97706", bg: "#fef3c7", icon: AlertTriangle },
                    { key: "expiring30", label: "Expiring in 30 days", color: "#ef4444", bg: "#fee2e2", icon: Calendar },
                    { key: "expiring60", label: "Expiring in 60 days", color: "#f97316", bg: "#ffedd5", icon: Calendar },
                    { key: "expiring90", label: "Expiring in 90 days", color: "#eab308", bg: "#fef9c3", icon: Calendar },
                    { key: "expired", label: "Expired", color: "#dc2626", bg: "#fef2f2", icon: X },
                  ].map(alertType => {
                    const alertItems = alerts.alerts[alertType.key] || [];
                    if (alertItems.length === 0) return null;
                    const Icon = alertType.icon;
                    return (
                      <div key={alertType.key} className="inv-card" style={{ borderColor: alertType.color }}>
                        <div className="inv-card-head" style={{ background: alertType.bg }}>
                          <div className="inv-card-title" style={{ color: alertType.color }}>
                            <Icon size={18} /> {alertType.label} ({alertItems.length})
                          </div>
                        </div>
                        <div className="inv-card-body" style={{ paddingTop: 0 }}>
                          {alertItems.slice(0, 20).map((alert: any) => (
                            <div key={`${alertType.key}-${alert.itemId}`} className="alert-card">
                              <div className="alert-icon" style={{ background: alertType.bg, color: alertType.color }}>
                                <Icon size={18} />
                              </div>
                              <div className="alert-content">
                                <div className="alert-title">{alert.itemName}</div>
                                <div className="alert-meta">
                                  <span>{alert.category}</span>
                                  {alert.currentStock !== undefined && <span>Stock: {alert.currentStock} {alert.unit}</span>}
                                  {alert.threshold !== undefined && <span>Threshold: {alert.threshold}</span>}
                                  {alert.quantity !== undefined && <span>Qty: {alert.quantity} {alert.unit}</span>}
                                  {alert.expiryDate && <span>Expires: {new Date(alert.expiryDate).toLocaleDateString()}</span>}
                                  <span className="alert-severity" style={{ background: alert.severity === "critical" ? "#fee2e2" : "#fef3c7", color: alert.severity === "critical" ? "#ef4444" : "#d97706" }}>
                                    {alert.severity}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {alertItems.length > 20 && (
                            <div style={{ textAlign: "center", padding: "16px", color: "#94a3b8", fontSize: "12px" }}>
                              And {alertItems.length - 20} more items...
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="inv-card">
            <div className="inv-card-head">
              <div className="inv-card-title">
                <FileText size={18} className="text-teal-600" />
                Inventory Reports
              </div>
            </div>
            <div className="inv-card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                {[
                  { type: "stock", title: "Current Stock Report", desc: "Complete inventory with quantities, values, and status" },
                  { type: "movement", title: "Stock Movement Report", desc: "All stock in/out transactions with filters" },
                  { type: "purchase", title: "Purchase Report", desc: "Purchase orders with supplier and item details" },
                  { type: "valuation", title: "Inventory Valuation", desc: "Cost vs retail value with profit analysis" },
                  { type: "expiry", title: "Expiry Report", desc: "Batch-wise expiry tracking with days remaining" },
                  { type: "low-stock", title: "Low Stock Report", desc: "Items at or below reorder level" },
                ].map(report => (
                  <button key={report.type} className="report-btn" onClick={() => exportReport(report.type)} disabled={reportsLoading}>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>{report.title}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{report.desc}</div>
                    <Download size={16} style={{ marginLeft: "auto", color: "#94a3b8" }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Item Modal */}
        {itemModalOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setItemModalOpen(false)}>
            <div className="modal modal-lg">
              <div className="modal-head">
                <h2 className="modal-title">{editingItem ? "Edit Item" : "Add Inventory Item"}</h2>
                <button className="modal-close" onClick={() => setItemModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleItemSubmit}>
                <div className="modal-body">
                  {itemFormError && <div className="form-error">{itemFormError}</div>}

                  <div className="section-title">Basic Information</div>
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">Item Name <span className="required">*</span></label>
                      <input className="form-input" type="text" name="name" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g., Paracetamol 500mg Tablet" autoFocus={!editingItem} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Generic Name</label>
                      <input className="form-input" type="text" name="genericName" value={itemForm.genericName} onChange={e => setItemForm(f => ({ ...f, genericName: e.target.value }))} placeholder="e.g., Paracetamol" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Brand Name</label>
                      <input className="form-input" type="text" name="brandName" value={itemForm.brandName} onChange={e => setItemForm(f => ({ ...f, brandName: e.target.value }))} placeholder="e.g., Crocin / Dolo" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Category <span className="required">*</span></label>
                      <select className="form-input" name="category" value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))} required>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Sub Category</label>
                      <input className="form-input" type="text" name="subCategory" value={itemForm.subCategory} onChange={e => setItemForm(f => ({ ...f, subCategory: e.target.value }))} placeholder="Tablet / Syrup / Injection" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Unit <span className="required">*</span></label>
                      <select className="form-input" name="unit" value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} required>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="section-divider" />
                  <div className="section-title">Pricing & Stock</div>
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">Purchase Price (Cost)</label>
                      <input className="form-input" type="number" name="purchasePrice" step="0.01" min="0" value={itemForm.purchasePrice} onChange={e => setItemForm(f => ({ ...f, purchasePrice: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">MRP</label>
                      <input className="form-input" type="number" name="mrp" step="0.01" min="0" value={itemForm.mrp} onChange={e => setItemForm(f => ({ ...f, mrp: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Selling Price</label>
                      <input className="form-input" type="number" name="sellingPrice" step="0.01" min="0" value={itemForm.sellingPrice} onChange={e => setItemForm(f => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">GST %</label>
                      <select className="form-input" name="gst" value={itemForm.gst} onChange={e => setItemForm(f => ({ ...f, gst: parseFloat(e.target.value) || 0 }))}>
                        {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Discount %</label>
                      <input className="form-input" type="number" name="discount" step="0.01" min="0" max="100" value={itemForm.discount} onChange={e => setItemForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Min Stock Alert <span className="required">*</span></label>
                      <input className="form-input" type="number" name="minStock" min="0" value={itemForm.minStock} onChange={e => setItemForm(f => ({ ...f, minStock: parseInt(e.target.value) || 0 }))} required />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Max Stock</label>
                      <input className="form-input" type="number" name="maxStock" min="0" value={itemForm.maxStock} onChange={e => setItemForm(f => ({ ...f, maxStock: e.target.value ? parseInt(e.target.value) : "" }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Reorder Level</label>
                      <input className="form-input" type="number" name="reorderLevel" min="0" value={itemForm.reorderLevel} onChange={e => setItemForm(f => ({ ...f, reorderLevel: e.target.value ? parseInt(e.target.value) : "" }))} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Reorder Qty</label>
                      <input className="form-input" type="number" name="reorderQty" min="0" value={itemForm.reorderQty} onChange={e => setItemForm(f => ({ ...f, reorderQty: e.target.value ? parseInt(e.target.value) : "" }))} />
                    </div>
                    <div className="form-field" style={{ display: editingItem ? "none" : "block" }}>
                      <label className="form-label">Opening Stock</label>
                      <input className="form-input" type="number" name="openingStock" min="0" value={itemForm.openingStock} onChange={e => setItemForm(f => ({ ...f, openingStock: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  <div className="section-divider" />
                  <div className="section-title">Advanced Details</div>
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">SKU Code</label>
                      <input className="form-input" type="text" name="sku" value={itemForm.sku} onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))} placeholder="Auto or manual" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Barcode</label>
                      <input className="form-input" type="text" name="barcode" value={itemForm.barcode} onChange={e => setItemForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Scan or enter" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">HSN Code</label>
                      <input className="form-input" type="text" name="hsnCode" value={itemForm.hsnCode} onChange={e => setItemForm(f => ({ ...f, hsnCode: e.target.value }))} placeholder="For GST billing" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Pack Size</label>
                      <input className="form-input" type="text" name="packSize" value={itemForm.packSize} onChange={e => setItemForm(f => ({ ...f, packSize: e.target.value }))} placeholder="e.g., 10 tablets per strip" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Unit Conversion</label>
                      <input className="form-input" type="text" name="conversion" value={itemForm.conversion} onChange={e => setItemForm(f => ({ ...f, conversion: e.target.value }))} placeholder="e.g., 1 Box = 10 strips" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Storage Location</label>
                      <input className="form-input" type="text" name="location" value={itemForm.location} onChange={e => setItemForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g., Pharmacy Store" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Rack / Shelf</label>
                      <input className="form-input" type="text" name="rackNumber" value={itemForm.rackNumber} onChange={e => setItemForm(f => ({ ...f, rackNumber: e.target.value }))} placeholder="e.g., A3-Shelf 2" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Temperature</label>
                      <select className="form-input" name="tempRequirement" value={itemForm.tempRequirement} onChange={e => setItemForm(f => ({ ...f, tempRequirement: e.target.value }))}>
                        <option value="Room Temp">Room Temp</option>
                        <option value="Refrigerated (2-8°C)">Refrigerated (2-8°C)</option>
                        <option value="Frozen (-20°C)">Frozen (-20°C)</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Drug Schedule</label>
                      <select className="form-input" name="drugSchedule" value={itemForm.drugSchedule} onChange={e => setItemForm(f => ({ ...f, drugSchedule: e.target.value }))}>
                        <option value="">None</option>
                        <option value="OTC">OTC</option>
                        <option value="Schedule H">Schedule H</option>
                        <option value="Schedule H1">Schedule H1</option>
                        <option value="Schedule X">Schedule X</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label className="form-label">Requires Prescription</label>
                      <div className="radio-group">
                        <button type="button" className={`radio-pill ${itemForm.requiresRx ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, requiresRx: true }))}>Yes</button>
                        <button type="button" className={`radio-pill ${!itemForm.requiresRx ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, requiresRx: false }))}>No</button>
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Is Critical</label>
                      <div className="radio-group">
                        <button type="button" className={`radio-pill ${itemForm.isCritical ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, isCritical: true }))}>Yes</button>
                        <button type="button" className={`radio-pill ${!itemForm.isCritical ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, isCritical: false }))}>No</button>
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Status</label>
                      <div className="radio-group">
                        <button type="button" className={`radio-pill ${itemForm.isActive ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, isActive: true }))}>Active</button>
                        <button type="button" className={`radio-pill ${!itemForm.isActive ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, isActive: false }))}>Inactive</button>
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Returnable</label>
                      <div className="radio-group">
                        <button type="button" className={`radio-pill ${itemForm.isReturnable ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, isReturnable: true }))}>Yes</button>
                        <button type="button" className={`radio-pill ${!itemForm.isReturnable ? "active" : ""}`} onClick={() => setItemForm(f => ({ ...f, isReturnable: false }))}>No</button>
                      </div>
                    </div>
                  </div>

                  <div className="form-field full-width">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" name="description" rows={3} value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes about this item..." style={{ resize: "none" }} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setItemModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={itemFormLoading}>
                    {itemFormLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {itemFormLoading ? "Saving..." : (editingItem ? "Update Item" : "Create Item")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stock Modal */}
        {stockModalOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStockModalOpen(false)}>
            <div className="modal">
              <div className="modal-head">
                <h2 className="modal-title">{stockModalType === "in" ? "Stock In" : "Stock Out"} - {stockItem?.name}</h2>
                <button className="modal-close" onClick={() => setStockModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleStockSubmit}>
                <div className="modal-body">
                  {stockFormError && <div className="form-error">{stockFormError}</div>}
                  <div className="form-grid">
                    <div className="form-field">
                      <label className="form-label">Quantity <span className="required">*</span></label>
                      <input className="form-input" type="number" min="1" required value={stockForm.quantity} onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))} />
                    </div>
                    {stockModalType === "in" && (
                      <>
                        <div className="form-field">
                          <label className="form-label">Batch Number</label>
                          <input className="form-input" type="text" value={stockForm.batchNumber} onChange={e => setStockForm(f => ({ ...f, batchNumber: e.target.value }))} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Expiry Date</label>
                          <input className="form-input" type="date" value={stockForm.expiryDate} onChange={e => setStockForm(f => ({ ...f, expiryDate: e.target.value }))} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Purchase Price</label>
                          <input className="form-input" type="number" step="0.01" min="0" value={stockForm.purchasePrice} onChange={e => setStockForm(f => ({ ...f, purchasePrice: e.target.value }))} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Selling Price</label>
                          <input className="form-input" type="number" step="0.01" min="0" value={stockForm.sellingPrice} onChange={e => setStockForm(f => ({ ...f, sellingPrice: e.target.value }))} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Supplier</label>
                          <select className="form-input" value={stockForm.supplierId} onChange={e => setStockForm(f => ({ ...f, supplierId: e.target.value }))}>
                            <option value="">Select Supplier</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label className="form-label">Source <span className="required">*</span></label>
                      <select className="form-input" value={stockForm.source} onChange={e => setStockForm(f => ({ ...f, source: e.target.value }))} required>
                        {stockModalType === "in" ? (
                          <>
                            <option value="PURCHASE">Purchase</option>
                            <option value="OPENING_STOCK">Opening Stock</option>
                            <option value="RETURN">Return</option>
                            <option value="TRANSFER_IN">Transfer In</option>
                            <option value="ADJUSTMENT">Adjustment</option>
                          </>
                        ) : (
                          <>
                            <option value="CONSUMPTION">Department Consumption</option>
                            <option value="PATIENT_USAGE">Patient Usage</option>
                            <option value="INTERNAL_ISSUE">Internal Issue</option>
                            <option value="DAMAGED">Damaged Stock</option>
                            <option value="EXPIRED">Expired Stock</option>
                            <option value="TRANSFER_OUT">Transfer Out</option>
                            <option value="RETURN_OUT">Return Out</option>
                            <option value="ADJUSTMENT">Adjustment</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Reference ID</label>
                      <input className="form-input" type="text" value={stockForm.referenceId} onChange={e => setStockForm(f => ({ ...f, referenceId: e.target.value }))} placeholder="PO No, Bill No, etc." />
                    </div>
                  </div>
                  <div className="form-field full-width">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={2} value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." style={{ resize: "none" }} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setStockModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={stockFormLoading}>
                    {stockFormLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {stockFormLoading ? "Processing..." : (stockModalType === "in" ? "Receive Stock" : "Issue Stock")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* History Modal */}
        {historyModalOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistoryModalOpen(false)}>
            <div className="modal modal-lg">
              <div className="modal-head">
                <h2 className="modal-title">Stock History - {historyItem?.name}</h2>
                <button className="modal-close" onClick={() => setHistoryModalOpen(false)}><X size={20} /></button>
              </div>
              <div className="modal-body" style={{ padding: 0, maxHeight: "60vh", overflow: "auto" }}>
                {historyLoading ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <Loader2 size={24} className="animate-spin mx-auto text-teal-600" />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="empty-state">
                    <FileText className="empty-state-icon" />
                    <div className="empty-state-title">No movement history</div>
                    <div className="empty-state-desc">Stock transactions will appear here</div>
                  </div>
                ) : (
                  <div>
                    <div className="history-row history-header">
                      <div>Date & Time</div>
                      <div>Type</div>
                      <div>Source</div>
                      <div>Qty</div>
                      <div>Batch</div>
                      <div>Notes</div>
                      <div>Reference</div>
                    </div>
                    {historyData.map((m: any) => (
                      <div key={m.id} className="history-row">
                        <div style={{ fontSize: "11px", whiteSpace: "nowrap" }}>
                          {new Date(m.createdAt).toLocaleDateString()}<br/>
                          <span style={{ color: "#94a3b8" }}>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div><span className={`history-type ${m.type === "IN" ? "in" : "out"}`}>{m.type}</span></div>
                        <div style={{ fontSize: "11px" }}>{m.source}</div>
                        <div style={{ fontWeight: 600, color: m.type === "IN" ? "#10b981" : "#ef4444" }}>{m.quantity}</div>
                        <div style={{ fontSize: "11px", fontFamily: "monospace" }}>{m.batch?.batchNumber || "-"}</div>
                        <div style={{ fontSize: "11px", color: "#64748b", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.notes || "-"}</div>
                        <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#94a3b8" }}>{m.referenceId || "-"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setHistoryModalOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {viewModalOpen && viewItem && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewModalOpen(false)}>
            <div className="modal">
              <div className="modal-head">
                <h2 className="modal-title">Item Details - {viewItem.name}</h2>
                <button className="modal-close" onClick={() => setViewModalOpen(false)}><X size={20} /></button>
              </div>
              <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="view-field"><span className="view-label">Item Name</span><span className="view-value">{viewItem.name}</span></div>
                <div className="view-field"><span className="view-label">Generic Name</span><span className="view-value">{viewItem.genericName || "-"}</span></div>
                <div className="view-field"><span className="view-label">Brand Name</span><span className="view-value">{viewItem.brandName || "-"}</span></div>
                <div className="view-field"><span className="view-label">Category</span><span className="view-value"><span className="category-badge">{getCategoryIcon(viewItem.category)}{viewItem.category}</span></span></div>
                <div className="view-field"><span className="view-label">Sub Category</span><span className="view-value">{viewItem.subCategory || "-"}</span></div>
                <div className="view-field"><span className="view-label">Unit</span><span className="view-value">{viewItem.unit}</span></div>
                <div className="view-field"><span className="view-label">SKU</span><span className="view-value">{viewItem.sku || "-"}</span></div>
                <div className="view-field"><span className="view-label">Barcode</span><span className="view-value">{viewItem.barcode || "-"}</span></div>
                <div className="view-field"><span className="view-label">HSN Code</span><span className="view-value">{viewItem.hsnCode || "-"}</span></div>
                <div className="view-field"><span className="view-label">Total Stock</span><span className="view-value" style={{ color: viewItem.totalStock <= viewItem.minStock ? "#ef4444" : "#10b981" }}>{viewItem.totalStock} {viewItem.unit}</span></div>
                <div className="view-field"><span className="view-label">Min Stock</span><span className="view-value">{viewItem.minStock}</span></div>
                <div className="view-field"><span className="view-label">Purchase Price</span><span className="view-value">₹{viewItem.purchasePrice}</span></div>
                <div className="view-field"><span className="view-label">Selling Price</span><span className="view-value">₹{viewItem.sellingPrice}</span></div>
                <div className="view-field"><span className="view-label">MRP</span><span className="view-value">₹{viewItem.mrp}</span></div>
                <div className="view-field"><span className="view-label">GST</span><span className="view-value">{viewItem.gst}%</span></div>
                <div className="view-field"><span className="view-label">Discount</span><span className="view-value">{viewItem.discount}%</span></div>
                <div className="view-field"><span className="view-label">Stock Value</span><span className="view-value">₹{viewItem.stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="view-field"><span className="view-label">Retail Value</span><span className="view-value">₹{viewItem.retailValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="view-field"><span className="view-label">Supplier</span><span className="view-value">{viewItem.supplier?.name || "-"}</span></div>
                <div className="view-field"><span className="view-label">Location</span><span className="view-value">{viewItem.location || "-"}</span></div>
                <div className="view-field"><span className="view-label">Rack</span><span className="view-value">{viewItem.rackNumber || "-"}</span></div>
                <div className="view-field"><span className="view-label">Temperature</span><span className="view-value">{viewItem.tempRequirement || "-"}</span></div>
                <div className="view-field"><span className="view-label">Drug Schedule</span><span className="view-value">{viewItem.drugSchedule || "-"}</span></div>
                <div className="view-field"><span className="view-label">Requires Rx</span><span className="view-value">{viewItem.requiresRx ? "Yes" : "No"}</span></div>
                <div className="view-field"><span className="view-label">Critical</span><span className="view-value">{viewItem.isCritical ? "Yes" : "No"}</span></div>
                <div className="view-field"><span className="view-label">Status</span><span className="view-value">{viewItem.isActive ? "Active" : "Inactive"}</span></div>
                <div className="view-field"><span className="view-label">Nearest Expiry</span><span className="view-value">{viewItem.nearestExpiry ? new Date(viewItem.nearestExpiry).toLocaleDateString() : "-"}</span></div>
                <div className="view-field full-width"><span className="view-label">Description</span><span className="view-value">{viewItem.description || "-"}</span></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setViewModalOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Supplier Modal */}
        {supplierModalOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSupplierModalOpen(false)}>
            <div className="modal modal-lg">
              <div className="modal-head">
                <h2 className="modal-title">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h2>
                <button className="modal-close" onClick={() => setSupplierModalOpen(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSupplierSubmit}>
                <div className="modal-body">
                  <div className="section-title">Basic Information</div>
                  <div className="form-grid">
                    <div className="form-field"><label className="form-label">Supplier Name <span className="required">*</span></label><input className="form-input" type="text" name="name" value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} required /></div>
                    <div className="form-field"><label className="form-label">Supplier Code</label><input className="form-input" type="text" name="code" value={supplierForm.code} onChange={e => setSupplierForm(f => ({ ...f, code: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Contact Person</label><input className="form-input" type="text" name="contactPerson" value={supplierForm.contactPerson} onChange={e => setSupplierForm(f => ({ ...f, contactPerson: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Designation</label><input className="form-input" type="text" name="designation" value={supplierForm.designation} onChange={e => setSupplierForm(f => ({ ...f, designation: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Phone</label><input className="form-input" type="text" name="phone" value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Alt Phone</label><input className="form-input" type="text" name="altPhone" value={supplierForm.altPhone} onChange={e => setSupplierForm(f => ({ ...f, altPhone: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Email</label><input className="form-input" type="email" name="email" value={supplierForm.email} onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))} /></div>
                  </div>

                  <div className="section-divider" />
                  <div className="section-title">Address</div>
                  <div className="form-grid">
                    <div className="form-field full-width"><label className="form-label">Address Line 1</label><input className="form-input" type="text" name="address1" value={supplierForm.address1} onChange={e => setSupplierForm(f => ({ ...f, address1: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Address Line 2</label><input className="form-input" type="text" name="address2" value={supplierForm.address2} onChange={e => setSupplierForm(f => ({ ...f, address2: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">City</label><input className="form-input" type="text" name="city" value={supplierForm.city} onChange={e => setSupplierForm(f => ({ ...f, city: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">State</label><input className="form-input" type="text" name="state" value={supplierForm.state} onChange={e => setSupplierForm(f => ({ ...f, state: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Pincode</label><input className="form-input" type="text" name="pincode" value={supplierForm.pincode} onChange={e => setSupplierForm(f => ({ ...f, pincode: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Country</label><input className="form-input" type="text" name="country" value={supplierForm.country} onChange={e => setSupplierForm(f => ({ ...f, country: e.target.value }))} /></div>
                  </div>

                  <div className="section-divider" />
                  <div className="section-title">Compliance & Licenses</div>
                  <div className="form-grid">
                    <div className="form-field"><label className="form-label">GST Number</label><input className="form-input" type="text" name="gstNumber" value={supplierForm.gstNumber} onChange={e => setSupplierForm(f => ({ ...f, gstNumber: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">PAN Number</label><input className="form-input" type="text" name="panNumber" value={supplierForm.panNumber} onChange={e => setSupplierForm(f => ({ ...f, panNumber: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Drug License</label><input className="form-input" type="text" name="drugLicense" value={supplierForm.drugLicense} onChange={e => setSupplierForm(f => ({ ...f, drugLicense: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">FSSAI License</label><input className="form-input" type="text" name="fssaiLicense" value={supplierForm.fssaiLicense} onChange={e => setSupplierForm(f => ({ ...f, fssaiLicense: e.target.value }))} /></div>
                  </div>

                  <div className="section-divider" />
                  <div className="section-title">Banking & Payment</div>
                  <div className="form-grid">
                    <div className="form-field"><label className="form-label">Bank Name</label><input className="form-input" type="text" name="bankName" value={supplierForm.bankName} onChange={e => setSupplierForm(f => ({ ...f, bankName: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Account Number</label><input className="form-input" type="text" name="accountNumber" value={supplierForm.accountNumber} onChange={e => setSupplierForm(f => ({ ...f, accountNumber: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">IFSC Code</label><input className="form-input" type="text" name="ifscCode" value={supplierForm.ifscCode} onChange={e => setSupplierForm(f => ({ ...f, ifscCode: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">UPI ID</label><input className="form-input" type="text" name="upiId" value={supplierForm.upiId} onChange={e => setSupplierForm(f => ({ ...f, upiId: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Payment Terms</label><input className="form-input" type="text" name="paymentTerms" value={supplierForm.paymentTerms} onChange={e => setSupplierForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Credit Limit</label><input className="form-input" type="number" step="0.01" name="creditLimit" value={supplierForm.creditLimit} onChange={e => setSupplierForm(f => ({ ...f, creditLimit: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="form-field"><label className="form-label">Opening Balance</label><input className="form-input" type="number" step="0.01" name="openingBalance" value={supplierForm.openingBalance} onChange={e => setSupplierForm(f => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))} /></div>
                    <div className="form-field"><label className="form-label">Preferred Payment Mode</label><input className="form-input" type="text" name="preferredPaymentMode" value={supplierForm.preferredPaymentMode} onChange={e => setSupplierForm(f => ({ ...f, preferredPaymentMode: e.target.value }))} /></div>
                  </div>

                  <div className="section-divider" />
                  <div className="section-title">Additional</div>
                  <div className="form-grid">
                    <div className="form-field"><label className="form-label">Categories Supplied</label><input className="form-input" type="text" name="categoriesSupplied" value={supplierForm.categoriesSupplied} onChange={e => setSupplierForm(f => ({ ...f, categoriesSupplied: e.target.value }))} placeholder="Medicines, Consumables, etc." /></div>
                    <div className="form-field"><label className="form-label">Brand Associations</label><input className="form-input" type="text" name="brandAssociations" value={supplierForm.brandAssociations} onChange={e => setSupplierForm(f => ({ ...f, brandAssociations: e.target.value }))} /></div>
                    <div className="form-field"><label className="form-label">Delivery Lead Time (days)</label><input className="form-input" type="number" name="deliveryLeadTime" value={supplierForm.deliveryLeadTime} onChange={e => setSupplierForm(f => ({ ...f, deliveryLeadTime: parseInt(e.target.value) || 0 }))} /></div>
                  </div>
                  <div className="form-field full-width"><label className="form-label">Notes</label><textarea className="form-input" rows={2} name="notes" value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "none" }} /></div>
                  <div className="form-field full-width"><label className="form-label">Special Instructions</label><textarea className="form-input" rows={2} name="specialInstructions" value={supplierForm.specialInstructions} onChange={e => setSupplierForm(f => ({ ...f, specialInstructions: e.target.value }))} style={{ resize: "none" }} /></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setSupplierModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={supplierFormLoading}>
                    {supplierFormLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {supplierFormLoading ? "Saving..." : (editingSupplier ? "Update Supplier" : "Create Supplier")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}