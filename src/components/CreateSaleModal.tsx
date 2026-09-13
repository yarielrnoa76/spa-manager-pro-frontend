import React, { useState, useEffect, useMemo, useCallback } from "react";
import { X, UserPlus } from "lucide-react";
import { api, ApiError } from "../services/api";
import LeadModal from "./LeadModal";
import { AuthenticatedUser, TenantSalesMode } from "../types";
import { useEffectiveSaleContext } from "../hooks/useEffectiveSaleContext";

type CreateSaleModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: AuthenticatedUser | null;
    initialData?: {
        lead_id?: string | number | null;
        client_name?: string;
        branch_id?: string | number | null;
    };
};

type ProductsLoadState = "idle" | "loading" | "success" | "empty" | "forbidden" | "error" | "blocked";

function toNumber(v: string): number {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
    return (Math.round(n * 100) / 100).toFixed(2);
}

function localISODate(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function localISODateTime(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

const CreateSaleModal: React.FC<CreateSaleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    user,
    initialData,
}) => {
    const isSuperAdmin = user?.is_super_admin === true;
    const isAdmin = isSuperAdmin;
    const perms: string[] = Array.isArray(user?.permissions) ? user!.permissions : [];
    const canViewLeads = isAdmin || perms.includes("view_leads");
    const canIncreasePrice = isAdmin || perms.includes("sale_increase_price");
    const canDecreasePrice = isAdmin || perms.includes("sale_decrease_price");
    const canEditPrice = canIncreasePrice || canDecreasePrice;
    const canViewProfessionals = isAdmin || perms.includes("view_professionals");
    const canViewTenantProfile = isAdmin || perms.includes("view_tenant_profile");

    // The ONE authority for "may this actor create a sale, in which branch, as which seller" --
    // entirely backend-computed (GET /api/sales/create-context). Nothing in this component ever
    // re-derives that from role.name, is_super_admin alone, or permission lists. `initialData`'s
    // branch is passed only as a HINT for the backend to validate on the first request -- it is
    // never adopted here before the backend echoes it back in `effectiveBranch`.
    const saleContext = useEffectiveSaleContext(
        user,
        isOpen,
        initialData?.branch_id != null ? Number(initialData.branch_id) : null,
    );
    const effectiveBranchId = saleContext.effectiveBranch?.id ?? null;

    const now = localISODateTime();

    const [form, setForm] = useState({
        date: now,
        product_id: "",
        lead_id: "",
        client_name: "",
        service_rendered: "",
        quantity: "1",
        unit_price: "",
        amount: "",
        payment_method: "Zelle",
        seller_id: "",
        professional_id: "",
        notes: "",
    });

    const [cart, setCart] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [productsState, setProductsState] = useState<ProductsLoadState>("idle");
    const [leads, setLeads] = useState<any[]>([]);
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Purely informational for this component: only decides which payload shape to send
    // (single grouped request vs. today's per-item loop). The backend independently reads the
    // tenant's own persisted sales_mode and is the real authority regardless of this value.
    // Deliberately stays `null` (never a 403) when the actor lacks view_tenant_profile -- the
    // existing independent_sales fallback below already covers that case correctly.
    const [salesMode, setSalesMode] = useState<TenantSalesMode | null>(null);

    // --- Seller: always the backend's own default; whenever the candidate list or default
    // changes (e.g. after a branch re-validation), a no-longer-authorized selection is reset back
    // to the default rather than left dangling on a stale id.
    useEffect(() => {
        if (!isOpen) return;
        setForm((prev) => {
            const defaultId = saleContext.defaultSeller ? String(saleContext.defaultSeller.id) : "";
            const isDefault = !!prev.seller_id && prev.seller_id === defaultId;
            const isAuthorizedCandidate =
                saleContext.canAssignOtherSeller &&
                saleContext.sellerCandidates.some((c) => String(c.id) === prev.seller_id);
            if (isDefault || isAuthorizedCandidate) return prev;
            return { ...prev, seller_id: defaultId };
        });
    }, [isOpen, saleContext.defaultSeller, saleContext.canAssignOtherSeller, saleContext.sellerCandidates]);

    useEffect(() => {
        if (!isOpen) return;

        setForm((prev) => ({
            ...prev,
            date: now,
            product_id: "",
            lead_id: initialData?.lead_id ? String(initialData.lead_id) : "",
            client_name: initialData?.client_name || "",
            service_rendered: "",
            quantity: "1",
            unit_price: "",
            amount: "",
            payment_method: "Zelle",
            professional_id: "",
            notes: "",
        }));
        setCart([]);
        setError(null);

        // Independently controlled loads (Promise.allSettled, explicit per-result handling) --
        // a single failing/unauthorized endpoint must never blank out payment methods or leads.
        // Products are handled in their OWN effect below, gated on the backend's own
        // `can_view_products` flag rather than bundled in here.
        Promise.allSettled([
            canViewLeads ? api.listLeads() : Promise.resolve([]),
            api.listPaymentMethods(),
            canViewProfessionals ? api.listProfessionals().catch(() => []) : Promise.resolve([]),
            canViewTenantProfile ? api.getTenantProfile().catch(() => null) : Promise.resolve(null),
        ]).then(([leadsRes, pmRes, profRes, tenantRes]) => {
            setLeads(leadsRes.status === "fulfilled" && Array.isArray(leadsRes.value) ? leadsRes.value : []);

            const pms = pmRes.status === "fulfilled" && Array.isArray(pmRes.value) ? pmRes.value : [];
            setPaymentMethods(pms);
            setForm((prev) => (prev.payment_method ? prev : { ...prev, payment_method: pms[0]?.name || prev.payment_method }));

            setProfessionals(profRes.status === "fulfilled" && Array.isArray(profRes.value) ? profRes.value : []);

            const tenant = tenantRes.status === "fulfilled" ? tenantRes.value : null;
            setSalesMode((tenant as { settings?: { sales_mode?: TenantSalesMode } } | null)?.settings?.sales_mode ?? null);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialData, canViewLeads, canViewProfessionals, canViewTenantProfile]);

    // --- Products: only ever requested when the backend's own create-context says so. While the
    // context itself is still loading (or failed), the catalog is neither requested nor
    // represented as merely "empty" -- it's an explicit, distinct block state. A 403 that still
    // happens despite can_view_products=true is `forbidden`; a genuine 200 with zero rows is
    // `empty`; a network/other failure is `error`. Never sends branch_id -- the catalog is
    // tenant-wide, not branch-scoped.
    useEffect(() => {
        if (!isOpen) return;

        if (saleContext.isLoading) {
            setProductsState("loading");
            return;
        }
        if (saleContext.fetchFailure || !saleContext.canViewProducts) {
            setProducts([]);
            setProductsState("blocked");
            return;
        }

        let cancelled = false;
        setProductsState("loading");
        api
            .listProducts()
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res) ? res : [];
                setProducts(list);
                setProductsState(list.length === 0 ? "empty" : "success");
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setProducts([]);
                const status = err instanceof ApiError ? err.status : undefined;
                setProductsState(status === 403 ? "forbidden" : "error");
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, saleContext.isLoading, saleContext.fetchFailure, saleContext.canViewProducts]);

    const clientNameInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isLeadModalOpen && isOpen) {
            const timer = setTimeout(() => {
                clientNameInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isLeadModalOpen, isOpen]);

    const availableProducts = products; // Allow all products, services might have 0 stock

    const leadSuggestions = useMemo(() => {
        if (!effectiveBranchId || initialData?.lead_id) return []; // Si ya está forzado el lead, no sugerimos
        const term = (form.client_name || "").toLowerCase();
        return leads.filter(lead => {
            const matchesBranch = String(lead.branch_id) === String(effectiveBranchId);
            const matchesName = lead.name.toLowerCase().includes(term);
            return matchesBranch && matchesName;
        }).slice(0, 5);
    }, [form.client_name, effectiveBranchId, leads, initialData]);

    const selectedProduct = useMemo(() => {
        const pid = String(form.product_id || "");
        if (!pid) return null;
        return availableProducts.find((x: any) => String(x.id) === pid) || products.find((x: any) => String(x.id) === pid) || null;
    }, [form.product_id, availableProducts, products]);

    const recalcTotals = (next: any) => {
        const qRaw = String(next.quantity ?? form.quantity ?? "").trim();
        const qty = Math.max(1, parseInt(qRaw, 10) || 1);

        const unitPriceStr = String(next.unit_price ?? form.unit_price).trim();
        // Allow typing dots
        if (unitPriceStr === "" || isNaN(Number(unitPriceStr))) {
            return { ...next, quantity: String(qty), amount: "" };
        }

        const unitPrice = toNumber(unitPriceStr);
        return { ...next, quantity: String(qty), amount: money(unitPrice * qty) };
    };

    const handleProductSelect = (productId: string) => {
        const p = availableProducts.find((x: any) => String(x.id) === String(productId)) || null;
        if (!p) {
            setForm(prev => ({ ...prev, product_id: "", service_rendered: "", unit_price: "", amount: "" }));
            return;
        }
        const salesPrice = toNumber(String((p as any).sales_price ?? 0));
        setForm(prev => ({ ...prev, ...recalcTotals({ product_id: String(p.id), service_rendered: p.name, unit_price: salesPrice ? money(salesPrice) : "" }), professional_id: "" }));
    };

    const handleQuantityChange = (qtyStr: string) => {
        if (qtyStr === "") {
            setForm(prev => ({ ...prev, quantity: "", amount: "" }));
            return;
        }
        let qty = parseInt(qtyStr.replace(/[^\d]/g, ""), 10);
        if (!Number.isFinite(qty) || qty <= 0) qty = 1;
        // Only cap quantity for physical products (not services)
        if (selectedProduct && (selectedProduct as any).type !== 'service' && qty > Number((selectedProduct as any).stock)) {
            qty = Math.max(1, Number((selectedProduct as any).stock));
        }
        setForm(prev => ({ ...prev, ...recalcTotals({ quantity: String(qty) }) }));
    };

    const handleAddToCart = () => {
        if (!form.product_id || !form.quantity) return;

        if (selectedProduct && !isAdmin) {
            const basePrice = toNumber(String((selectedProduct as any).sales_price ?? 0));
            const requestPrice = toNumber(form.unit_price);

            if (requestPrice > basePrice && !canIncreasePrice) {
                setError(`No tienes permiso para subir el precio. (Precio base: $${money(basePrice)})`);
                return;
            }
            if (requestPrice < basePrice && !canDecreasePrice) {
                setError(`No tienes permiso para bajar el precio. (Precio base: $${money(basePrice)})`);
                return;
            }
        }

        setError(null);

        setCart(prev => [...prev, {
            id: Date.now().toString(),
            product_id: form.product_id,
            service_rendered: form.service_rendered,
            quantity: parseInt(form.quantity, 10),
            unit_price: toNumber(form.unit_price),
            amount: toNumber(form.amount),
            professional_id: form.professional_id || null,
        }]);
        setForm(prev => ({ ...prev, product_id: "", service_rendered: "", quantity: "1", unit_price: "", amount: "", professional_id: "" }));
    };

    const handleRemoveFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const cartTotalAmount = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.amount, 0);
    }, [cart]);

    /**
     * The real security boundary for this form: re-derives "is this actually submittable" from
     * the backend's own `create-context` and candidate lists, independent of whatever any
     * control's own `disabled` attribute currently shows. `contextReady` is the primary gate --
     * a `disabled` select never stood between a tampered DOM and the request in the first place.
     */
    const validateBeforeSubmit = useCallback((): string | null => {
        if (saleContext.fetchFailure) {
            return saleContext.blockingMessage ?? "No se pudo verificar tu contexto de venta.";
        }
        if (!saleContext.contextReady) {
            return saleContext.blockingMessage ?? "No se pudo determinar tu contexto de venta. Inténtalo de nuevo.";
        }

        const sellerId = form.seller_id;
        const isDefaultSeller = !!sellerId && !!saleContext.defaultSeller && sellerId === String(saleContext.defaultSeller.id);
        const isAuthorizedCandidate =
            saleContext.canAssignOtherSeller && saleContext.sellerCandidates.some((c) => String(c.id) === sellerId);
        if (!sellerId || (!isDefaultSeller && !isAuthorizedCandidate)) {
            return "Selecciona un vendedor autorizado antes de continuar.";
        }

        if (!form.lead_id) return "Debes seleccionar o crear un cliente válido (Lead).";
        if (cart.length === 0) return "Debes añadir al menos un producto a la venta.";

        return null;
    }, [saleContext, form.seller_id, form.lead_id, cart.length]);

    const handleCreateSale = async (e: React.FormEvent) => {
        e.preventDefault();

        const validationError = validateBeforeSubmit();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const sharedFields = {
                date: form.date,
                branch_id: effectiveBranchId,
                lead_id: form.lead_id,
                client_name: form.client_name,
                payment_method: form.payment_method,
                seller_id: form.seller_id,
                notes: form.notes,
            };

            if (salesMode === "grouped_sale") {
                // Single request with every cart item — the backend still independently
                // verifies the tenant is actually grouped_sale before treating this as a group.
                await api.createSale({
                    ...sharedFields,
                    items: cart.map(item => ({
                        product_id: item.product_id || null,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        amount: item.amount,
                        service_rendered: item.service_rendered,
                        professional_id: item.professional_id || null,
                    })),
                });
            } else {
                // independent_sales (or sales_mode not yet known) — today's unchanged flow:
                // one independent request per cart item.
                for (const item of cart) {
                    await api.createSale({
                        ...sharedFields,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        amount: item.amount,
                        product_id: item.product_id || null,
                        service_rendered: item.service_rendered,
                        professional_id: item.professional_id || null,
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err?.message || "Error al crear la venta");
        } finally {
            setLoading(false);
        }
    };

    const handleLeadCreatedFromModal = (lead: any) => {
        setLeads(prev => [lead, ...prev]);
        const fullName = [lead.name, lead.last_name].filter(Boolean).join(" ");
        setForm(prev => ({ ...prev, client_name: fullName, lead_id: String(lead.id) }));
        setIsLeadModalOpen(false);
    };

    const canAdd = form.product_id && form.quantity && toNumber(form.quantity) > 0;
    const canSubmit = !validateBeforeSubmit();

    if (!isOpen && !isLeadModalOpen) return null;

    const sellerOptions: Array<{ id: string; name: string }> = saleContext.canAssignOtherSeller
        ? saleContext.sellerCandidates.map((c) => ({ id: String(c.id), name: c.name }))
        : [];
    const showsSelfAsOnlySellerOption =
        !!saleContext.defaultSeller && !sellerOptions.some((o) => o.id === String(saleContext.defaultSeller!.id));

    return (
        <>
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg">Nueva Venta {initialData?.lead_id ? 'para este Lead' : ''}</h3>
                            <button type="button" onClick={onClose}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleCreateSale} className="p-6 space-y-4 overflow-y-auto">
                            {error && (
                                <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-4">
                                    {error}
                                </div>
                            )}
                            {!error && saleContext.blockingMessage && (
                                <div className="bg-amber-50 text-amber-700 p-3 rounded text-sm mb-4">
                                    {saleContext.blockingMessage}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                                    <select
                                        required
                                        disabled={!saleContext.canSelectBranch}
                                        className={`w-full border rounded-lg p-2 text-sm ${!saleContext.canSelectBranch ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""}`}
                                        value={effectiveBranchId != null ? String(effectiveBranchId) : ""}
                                        onChange={(e) => {
                                            const id = Number(e.target.value);
                                            if (Number.isFinite(id)) {
                                                saleContext.selectBranch(id);
                                                setForm(prev => ({ ...prev, client_name: "", lead_id: "" }));
                                            }
                                        }}
                                    >
                                        {saleContext.canSelectBranch ? (
                                            <>
                                                <option value="">Seleccionar...</option>
                                                {saleContext.availableBranches.map(b => (
                                                    <option key={b.id} value={String(b.id)}>{b.name}</option>
                                                ))}
                                            </>
                                        ) : saleContext.effectiveBranch ? (
                                            <option value={String(saleContext.effectiveBranch.id)}>{saleContext.effectiveBranch.name}</option>
                                        ) : (
                                            <option value="">{saleContext.isLoading ? "Cargando..." : "Sin sucursal disponible"}</option>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        className="w-full border rounded-lg p-2 text-sm"
                                        value={form.date}
                                        onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                                        max={localISODate()}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-[2] relative">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Cliente</label>
                                    <div className="relative">
                                        <input
                                            ref={clientNameInputRef}
                                            type="text"
                                            required
                                            disabled={!effectiveBranchId || !!initialData?.lead_id}
                                            placeholder={effectiveBranchId ? "Buscar en leads..." : "Elige sucursal primero"}
                                            className={`w-full border rounded-lg p-2 text-sm ${(!effectiveBranchId || !!initialData?.lead_id) ? "bg-gray-50 text-gray-500" : ""}`}
                                            value={form.client_name}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            onChange={(e) => setForm(prev => ({ ...prev, client_name: e.target.value, lead_id: "" }))}
                                        />
                                        {canViewLeads && showSuggestions && !initialData?.lead_id && (
                                            <div className="absolute top-100 left-0 w-full bg-white border rounded shadow-lg z-50 max-h-40 overflow-auto">
                                                {leadSuggestions.map(lead => (
                                                    <div
                                                        key={lead.id}
                                                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm flex justify-between"
                                                        onClick={() => {
                                                            setForm(prev => ({ ...prev, client_name: lead.name, lead_id: String(lead.id) }));
                                                            setShowSuggestions(false);
                                                        }}
                                                    >
                                                        <span>{lead.name}</span>
                                                        <span className="text-gray-400 text-xs">{lead.status}</span>
                                                    </div>
                                                ))}

                                                {leadSuggestions.length === 0 && form.client_name.trim().length > 0 && (
                                                    <div
                                                        className="px-4 py-2 border-t text-indigo-600 font-bold hover:bg-indigo-50 cursor-pointer flex items-center gap-2 text-sm"
                                                        onClick={() => {
                                                            setIsLeadModalOpen(true);
                                                            setShowSuggestions(false);
                                                        }}
                                                    >
                                                        <UserPlus size={14} /> Crear "{form.client_name}" como Lead
                                                    </div>
                                                )}

                                                {leadSuggestions.length === 0 && form.client_name.trim().length === 0 && (
                                                    <div className="px-4 py-2 text-gray-400 text-xs italic">
                                                        Escribe para buscar...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {!form.lead_id && !initialData?.lead_id && form.client_name.length > 0 && (
                                        <p className="text-xs text-red-500 mt-1">Debes seleccionar o crear un lead en la sugerencia.</p>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pago</label>
                                    <select
                                        required
                                        className="w-full border rounded-lg p-2 text-sm"
                                        value={form.payment_method}
                                        onChange={(e) => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                                    >
                                        {paymentMethods.length > 0 ? (
                                            paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)
                                        ) : (
                                            <>
                                                <option value="Efectivo">Efectivo</option>
                                                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                                                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                                                <option value="Transferencia">Transferencia</option>
                                                <option value="Depósito">Depósito</option>
                                                <option value="Cheque">Cheque</option>
                                                <option value="Zelle">Zelle</option>
                                                <option value="Otro">Otro</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Producto / Servicio</label>
                                    {productsState === "blocked" ? (
                                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                                            El catálogo de productos no está disponible para tu cuenta.
                                        </p>
                                    ) : productsState === "forbidden" ? (
                                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                                            No tienes autorización para ver el catálogo de productos.
                                        </p>
                                    ) : productsState === "error" ? (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                            No se pudo cargar el catálogo. Verifica tu conexión e inténtalo de nuevo.
                                        </p>
                                    ) : (
                                        <select
                                            className="w-full border rounded-lg p-2 text-sm"
                                            value={form.product_id}
                                            disabled={productsState === "loading" || productsState === "empty"}
                                            onChange={(e) => handleProductSelect(e.target.value)}
                                        >
                                            <option value="">
                                                {productsState === "loading"
                                                    ? "Cargando..."
                                                    : productsState === "empty"
                                                        ? "-- Sin productos disponibles --"
                                                        : "-- Seleccionar de Inventario --"}
                                            </option>
                                            {availableProducts.map((p: any) => (
                                                <option key={p.id} value={String(p.id)}>
                                                    {p.name} {p.type !== 'service' ? `(Stock: ${p.stock})` : ''} (Price: {p.sales_price})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vendedor</label>
                                    <select
                                        className="w-full border rounded-lg p-2 text-sm"
                                        value={form.seller_id}
                                        onChange={(e) => setForm(prev => ({ ...prev, seller_id: e.target.value }))}
                                        disabled={!saleContext.canAssignOtherSeller}
                                    >
                                        {sellerOptions.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                        {/* The backend's own default seller is always available, whether or not this
                                            actor can assign someone else -- never dependent on any list having
                                            loaded successfully. */}
                                        {showsSelfAsOnlySellerOption && (
                                            <option value={String(saleContext.defaultSeller!.id)}>{saleContext.defaultSeller!.name}</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Mostrar dropdown de Profesional solo si hay un producto seleccionado */}
                            {selectedProduct && (
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Profesional (Opcional para productos físicos)</label>
                                        <select
                                            className="w-full border rounded-lg p-2 text-sm"
                                            value={form.professional_id}
                                            onChange={(e) => setForm(prev => ({ ...prev, professional_id: e.target.value }))}
                                            required={(selectedProduct as any).type === 'service'}
                                        >
                                            <option value="">-- Seleccionar Profesional --</option>
                                            {((selectedProduct as any).type === 'service' ? (selectedProduct as any).professionals || [] : professionals)
                                                .filter((p: any) => !effectiveBranchId || p.branch_id === effectiveBranchId)
                                                .map((p: any) => (
                                                <option key={p.id} value={String(p.id)}>{p.fname} {p.lname} - {p.title}</option>
                                            ))}
                                        </select>
                                        {(selectedProduct as any).type === 'service' && (
                                            <p className="text-[10px] text-gray-400 mt-1">Requerido para servicios.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio Unitario ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className={`w-full border rounded-lg p-2 text-sm font-bold ${!canEditPrice ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                                        value={form.unit_price}
                                        disabled={!form.product_id || !canEditPrice}
                                        onChange={(e) => {
                                            setForm(prev => ({ ...prev, ...recalcTotals({ unit_price: e.target.value }) }));
                                        }}
                                        title={!canEditPrice ? "No tienes permiso para modificar el precio" : ""}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cantidad</label>
                                    <input
                                        type="number"
                                        min={1}
                                        className="w-full border rounded-lg p-2 text-sm font-bold"
                                        value={form.quantity}
                                        onChange={(e) => handleQuantityChange(e.target.value)}
                                        disabled={!form.product_id}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total ($)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            className="w-full border rounded-lg p-2 text-sm font-bold bg-gray-50"
                                            value={form.amount}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddToCart}
                                            disabled={!canAdd}
                                            className="bg-emerald-600 text-white px-4 rounded-lg font-bold text-xs hover:bg-emerald-700 disabled:bg-gray-300 transition-colors whitespace-nowrap"
                                        >
                                            Añadir
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {cart.length > 0 && (
                                <div className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3 space-y-2">
                                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Productos en Venta</p>
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between bg-white px-3 py-2 rounded shadow-sm text-sm border border-emerald-50">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{item.service_rendered}</span>
                                                <span className="text-xs text-gray-500">{item.quantity} x ${item.unit_price}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-emerald-700">${item.amount.toFixed(2)}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFromCart(item.id)}
                                                    className="text-red-400 hover:text-red-600 font-bold p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center px-3 pt-2 font-black text-gray-800">
                                        <span>Total Final:</span>
                                        <span className="text-lg text-indigo-600">${cartTotalAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas</label>
                                <textarea
                                    className="w-full border rounded-lg p-2 text-sm"
                                    value={form.notes}
                                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={2}
                                />
                            </div>

                            <div className="pt-4 flex gap-3 pb-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2 border rounded-lg text-sm font-bold"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={!canSubmit || loading}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold text-white ${canSubmit && !loading ? "bg-indigo-600 shadow-lg hover:bg-indigo-700" : "bg-gray-300"}`}
                                >
                                    {loading ? 'Confirmando...' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <LeadModal
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                onSuccess={handleLeadCreatedFromModal}
                user={user}
                initialBranchId={effectiveBranchId != null ? String(effectiveBranchId) : ""}
                initialName={form.client_name}
                zIndexClass="z-[150]"
            />
        </>
    );
};

export default CreateSaleModal;
