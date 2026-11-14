"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserSessionProfile } from "@/lib/types";
import {
  Database,
  ArrowLeft,
  RefreshCw,
  Search,
  Download,
  Layers,
  Activity,
  Server,
  FileCode,
  Shield,
  Eye,
  X,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";

interface CollectionSummary {
  name: string;
  modelName: string;
  documentCount: number;
  indexCount: number;
  indexes: Array<{ name: string; key: Record<string, any>; unique?: boolean }>;
}

interface OverviewData {
  health: {
    connected: boolean;
    state: string;
    databaseName: string | null;
    host: string | null;
    modelsLoaded: number;
  };
  collections: CollectionSummary[];
  storage: {
    available: boolean;
    reason?: string;
    dbName?: string;
    collectionsCount?: number;
    objectsCount?: number;
    avgObjSize?: string;
    dataSize?: string;
    storageSize?: string;
    indexesCount?: number;
    indexSize?: string;
  };
  relationships: Array<{
    from: string;
    to: string;
    foreignKey: string;
    type: string;
    required: boolean;
  }>;
}

interface DatabaseExplorerProps {
  currentUser: UserSessionProfile;
}

export function DatabaseExplorer({ currentUser }: DatabaseExplorerProps) {
  const [activeTab, setActiveTab] = useState<"collections" | "metrics" | "relationships">("collections");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string>("users");

  // Collection browser states
  const [documents, setDocuments] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [searchField, setSearchField] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal inspection
  const [inspectDoc, setInspectDoc] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoadingOverview(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/database/overview");
      if (!res.ok) {
        throw new Error(`Overview query failed (${res.status})`);
      }
      const data: OverviewData = await res.json();
      setOverview(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error connecting to MongoDB explorer API");
    } finally {
      setLoadingOverview(false);
    }
  };

  const fetchDocuments = async (colName: string, p: number = 1) => {
    setLoadingDocs(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: p.toString(),
        limit: "15",
      });
      if (searchId) {
        params.set("searchId", searchId);
      } else if (searchField && searchQuery) {
        params.set("searchField", searchField);
        params.set("searchQuery", searchQuery);
      }

      const res = await fetch(`/api/admin/database/collections/${colName}?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load documents for ${colName}`);
      }
      const data = await res.json();
      setDocuments(data.documents);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotalDocs(data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error querying collection documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      setPage(1);
      fetchDocuments(selectedCollection, 1);
    }
  }, [selectedCollection]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments(selectedCollection, 1);
  };

  const handleClearSearch = () => {
    setSearchId("");
    setSearchField("");
    setSearchQuery("");
    fetchDocuments(selectedCollection, 1);
  };

  const copyToClipboard = (text: string, type: "id" | "json") => {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const totalRecordsAcrossAll = overview
    ? overview.collections.reduce((sum, c) => sum + c.documentCount, 0)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin Moderation Desk
              </Link>
              <span>/</span>
              <span className="text-slate-700 dark:text-slate-300">Database Administration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
              <Database className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              MongoDB Database Explorer & Metrics
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Read-only administrative inspector for CampusConnect MongoDB Atlas cluster, Mongoose models, and storage topologies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchOverview();
                if (selectedCollection) fetchDocuments(selectedCollection, page);
              }}
              disabled={loadingOverview}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", loadingOverview && "animate-spin")} />
              Refresh Metrics
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {overview?.health.connected ? "MongoDB Atlas: Connected" : "Connecting..."}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Explorer Notice</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* High Level Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Database Name</span>
              <Server className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold mt-2 text-slate-900 dark:text-slate-100">
              {overview?.health.databaseName || "campusconnect"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Host: {overview?.health.host ? overview.health.host.split(".")[0] : "Atlas Cluster"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Active Collections</span>
              <Layers className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold mt-2 text-slate-900 dark:text-slate-100">
              {overview?.collections.length || 12} Collections
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">12 Mongoose Models Active</p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Total Persisted Records</span>
              <FileCode className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xl font-bold mt-2 text-slate-900 dark:text-slate-100">
              {totalRecordsAcrossAll} Documents
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all application collections</p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
              <span>Storage Data Size</span>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold mt-2 text-slate-900 dark:text-slate-100">
              {overview?.storage.available ? overview.storage.dataSize : "Dynamic Sandbox"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Storage: {overview?.storage.available ? overview.storage.storageSize : "M0 Free Tier"}
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("collections")}
            className={clsx(
              "px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors",
              activeTab === "collections"
                ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Layers className="w-4 h-4" />
            Collections Document Browser
          </button>
          <button
            onClick={() => setActiveTab("metrics")}
            className={clsx(
              "px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors",
              activeTab === "metrics"
                ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Server className="w-4 h-4" />
            Engine Metrics & Indexes
          </button>
          <button
            onClick={() => setActiveTab("relationships")}
            className={clsx(
              "px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors",
              activeTab === "relationships"
                ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Activity className="w-4 h-4" />
            Schema Relationships & Topologies
          </button>
        </div>

        {/* TAB 1: COLLECTIONS DOCUMENT BROWSER */}
        {activeTab === "collections" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar Collection Picker */}
            <div className="lg:col-span-3 space-y-2">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 px-2">
                  Collections (12)
                </h3>
                <div className="space-y-1">
                  {overview?.collections.map((col) => {
                    const isSelected = selectedCollection === col.name;
                    return (
                      <button
                        key={col.name}
                        onClick={() => setSelectedCollection(col.name)}
                        className={clsx(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left",
                          isSelected
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <span className="font-mono">{col.name}</span>
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            isSelected
                              ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          )}
                        >
                          {col.documentCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Anonymity Security Notice */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Privacy & Audit Protection
                </p>
                <p>
                  Public chats decouple student roll numbers from handles. De-anonymizing records requires super_admin role and creates an immutable audit trail.
                </p>
              </div>
            </div>

            {/* Document Browser Area */}
            <div className="lg:col-span-9 space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                {/* Collection action bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Active Collection</span>
                    <h2 className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                      {selectedCollection}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Showing {documents.length} of {totalDocs} documents (Page {page} of {totalPages})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/admin/database/collections/${selectedCollection}/export`}
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export JSON
                    </a>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="Search by _id (ObjectId)..."
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Field (e.g. collegeId, type)..."
                      value={searchField}
                      onChange={(e) => setSearchField(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Search text / regex..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-1">
                    <button
                      type="submit"
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" /> Filter
                    </button>
                    {(searchId || searchField || searchQuery) && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="px-2 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </form>

                {/* Table of Documents */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                      <tr>
                        <th className="p-3 font-semibold">Document _id</th>
                        <th className="p-3 font-semibold">Primary Fields</th>
                        <th className="p-3 font-semibold">Created / Timestamp</th>
                        <th className="p-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                      {loadingDocs ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                            Loading documents from MongoDB...
                          </td>
                        </tr>
                      ) : documents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500">
                            No documents found in <span className="font-mono">{selectedCollection}</span> matching filter.
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => {
                          const docId = doc._id || doc.id;
                          const createdDate = doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "N/A";
                          // Extract 2 key descriptive fields
                          const summaryFields = Object.entries(doc)
                            .filter(
                              ([k]) =>
                                !["_id", "id", "createdAt", "updatedAt", "__v", "password"].includes(k)
                            )
                            .slice(0, 3);

                          return (
                            <tr
                              key={docId}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="p-3 font-mono text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                <div className="flex items-center gap-1.5">
                                  <span>{docId}</span>
                                  <button
                                    onClick={() => copyToClipboard(docId, "id")}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                                    title="Copy ObjectId"
                                  >
                                    {copiedId === docId ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 max-w-md truncate">
                                <div className="flex flex-wrap gap-1.5">
                                  {summaryFields.map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300"
                                    >
                                      <span className="text-slate-400 font-mono">{k}:</span>
                                      <span className="font-medium max-w-[150px] truncate">
                                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {createdDate}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => setInspectDoc(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors"
                                >
                                  <Eye className="w-3 h-3" /> View JSON
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 text-xs">
                    <button
                      onClick={() => fetchDocuments(selectedCollection, page - 1)}
                      disabled={page <= 1 || loadingDocs}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Previous
                    </button>
                    <span className="text-slate-500">
                      Page <strong className="text-slate-900 dark:text-slate-100">{page}</strong> of {totalPages}
                    </span>
                    <button
                      onClick={() => fetchDocuments(selectedCollection, page + 1)}
                      disabled={page >= totalPages || loadingDocs}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40 font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEVELOPER & ENGINE METRICS */}
        {activeTab === "metrics" && (
          <div className="space-y-6">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-500" />
                Cluster Infrastructure & Mongoose Specifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block font-mono">ODS / ODM Engine</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Mongoose ^8.10.x</span>
                  <p className="text-[11px] text-slate-400 mt-1">Schema validation & strict types enabled</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block font-mono">Connection Pool</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Cached Singleton (Max 10)</span>
                  <p className="text-[11px] text-slate-400 mt-1">Safe for Next.js HMR & Vercel serverless</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block font-mono">Cursor Pagination Algorithm</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Composite (createdAt, _id)</span>
                  <p className="text-[11px] text-slate-400 mt-1">Deterministic Base64url pagination tokens</p>
                </div>
              </div>
            </div>

            {/* Indexes per collection */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                Engine Compound & Unique Indexes Across Collections
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overview?.collections.map((col) => (
                  <div
                    key={col.name}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {col.name} ({col.modelName})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold text-[10px]">
                        {col.indexCount} Indexes
                      </span>
                    </div>
                    <div className="space-y-1">
                      {col.indexes.map((idx) => (
                        <div
                          key={idx.name}
                          className="flex items-start justify-between gap-2 p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 font-mono text-[11px]"
                        >
                          <div className="truncate">
                            <span className="text-slate-400">{idx.name}: </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {JSON.stringify(idx.key)}
                            </span>
                          </div>
                          {idx.unique && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                              Unique
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEMA RELATIONSHIPS & TOPOLOGIES */}
        {activeTab === "relationships" && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                MongoDB Entity-Relationship Reference Model
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                CampusConnect models document relationships via typed BSON ObjectId references (ref: &apos;Model&apos;) rather than unlimited unbounded document nesting, ensuring high-scale consistency and bounded BSON sizes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {overview?.relationships.map((rel, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{rel.from}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">
                      {rel.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 font-mono">
                    <span>Reference Key:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{rel.foreignKey}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <span>Target Entity:</span>
                    <strong className="font-mono text-purple-600 dark:text-purple-400">{rel.to}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document JSON Inspector Modal */}
        {inspectDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold font-mono">
                      {selectedCollection} / {inspectDoc._id || inspectDoc.id}
                    </h3>
                    <p className="text-[10px] text-slate-500">BSON Document Inspection View</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(inspectDoc, null, 2), "json")}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy JSON
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setInspectDoc(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 overflow-y-auto font-mono text-xs bg-slate-900 text-emerald-400 selection:bg-emerald-800 selection:text-white">
                <pre className="whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(inspectDoc, null, 2)}
                </pre>
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center text-xs text-slate-500">
                <span>Read-Only Administrative View</span>
                <button
                  onClick={() => setInspectDoc(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
