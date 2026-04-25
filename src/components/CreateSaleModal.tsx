import React, { useState, useEffect, useMemo } from "react";
import { X, UserPlus } from "lucide-react";
import { api } from "../services/api";
import LeadModal from "./LeadModal";

type CreateSaleModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user: any;
    initialData?: {
        lead_id?: string | number | null;
        client_name?: string;
        branch_id?: string | number | null;
    };
};

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

const CreateSaleModal: React.FC<CreateSaleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    user,
    initialData,
}) => {
    const isSuperAdmin = user?.is_super_admin === true;
    const isAdmin = user?.role?.name === "admin" || isSuperAdmin;
    const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    const canViewLeads = isAdmin || perms.includes("view_leads");
    
    // Un usuario está restringido a su sucursal si no es admin ni superadmin y tiene una sucursal asignada
    const isBranchRestricted = user?.branch_id && user?.role?.name !== "admin" && !user?.is_super_admin;
    const canSelectBranch = !isBranchRestricted && (isAdmin || perms.includes("view_branch"));

    const today = localISODate();

    const [form, setForm] = useState({
        date: today,
        branch_id: "",
        product_id: "",
        lead_id: "",
        client_name: "",
        service_rendered: "",
        quantity: "1",
        unit_price: "",
        amount: "",
        payment_method: "Zelle",
        seller_id: "",
        notes: "",
    });

    const [cart, setCart] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setForm({
            date: today,
            branch_id: initialData?.branch_id ? String(initialData.branch_id) : (user?.branch?.id ? String(user.branch.id) : ""),
            product_id: "",
            lead_id: initialData?.lead_id ? String(initialData.lead_id) : "",
            client_name: initialData?.client_name || "",
            service_rendered: "",
            quantity: "1",
            unit_price: "",
            amount: "",
            payment_method: "Zelle",
            seller_id: user?.id ? String(user.id) : "",
            notes: "",
        });
        setCart([]);
        setError(null);

        Promise.all([
            canSelectBranch ? api.listBranches() : (user?.branch ? Promise.resolve([user.branch]) : Promise.resolve([])),
            api.listProducts(),
            canViewLeads ? api.listLeads() : Promise.resolve([]),
            api.listPaymentMethods(),
            canSelectBranch ? api.listUsers().catch(() => []) : Promise.resolve([]),
        ]).then(([b, p, l, pm, u]) => {
            setBranches(Array.isArray(b) ? b : []);
            setProducts(Array.isArray(p) ? p : []);
            setLeads(Array.isArray(l) ? l : []);
            setUsers(Array.isArray(u) ? u : []);

            const pms = Array.isArray(pm) ? pm : [];
            setPaymentMethods(pms);
            if (pms.length > 0 && !form.payment_method) {
                setForm(prev => ({ ...prev, payment_method: pms[0].name }));
            }
        }).catch(err => {
            console.error(err);
        });
    }, [isOpen, initialData, user]);

    const availableProducts = products; // Allow all products, services might have 0 stock

    const leadSuggestions = useMemo(() => {
        if (!form.branch_id || initialData?.lead_id) return []; // Si ya está forzado el lead, no sugerimos
        const term = (form.client_name || "").toLowerCase();
        return leads.filter(lead => {
            const matchesBranch = String(lead.branch_id) === String(form.branch_id);
            const matchesName = lead.name.toLowerCase().includes(term);
            return matchesBranch && matchesName;
        }).slice(0, 5);
    }, [form.client_name, form.branch_id, leads, initialData]);

    const selectedProduct = useMemo(() => {
        const pid = String(form.product_id || "");
        if (!pid) return null;
        return availableProducts.find((x: any) => String(x.id) === pid) || products.find((x: any) => String(x.id) === pid) || null;
    }, [form.product_id, availableProducts, products]);

    const recalcTotals = (next: any) => {
        const qRaw = String(next.quantity ?? form.quantity ?? "").trim();
        if (!qRaw) return { ...next, quantity: "", amount: "" };
        const qty = Math.max(1, parseInt(qRaw, 10) || 1);
        const unitPrice = toNumber(String(next.unit_price ?? form.unit_price));
        return { ...next, quantity: String(qty), amount: unitPrice ? money(unitPrice * qty) : "" };
    };

    const handleProductSelect = (productId: string) => {
        const p = availableProducts.find((x: any) => String(x.id) === String(productId)) || null;
        if (!p) {
            setForm(prev => ({ ...prev, product_id: "", service_rendered: "", unit_price: "", amount: "" }));
            return;
        }
        const salesPrice = toNumber(String((p as any).sales_price ?? 0));
        setForm(prev => ({ ...prev, ...recalcTotals({ product_id: String(p.id), service_rendered: p.name, unit_price: salesPrice ? money(salesPrice) : "" }) }));
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
        setCart(prev => [...prev, {
            id: Date.now().toString(),
            product_id: form.product_id,
            service_rendered: form.service_rendered,
            quantity: parseInt(form.quantity, 10),
            unit_price: toNumber(form.unit_price),
            amount: toNumber(form.amount),
        }]);
        setForm(prev => ({ ...prev, product_id: "", service_rendered: "", quantity: "1", unit_price: "", amount: "" }));
    };

    const handleRemoveFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const cartTotalAmount = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.amount, 0);
    }, [cart]);

    const handleCreateSale = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validación custom
        if (!form.lead_id) {
            setError("Debes seleccionar o crear un cliente válido (Lead).");
            return;
        }
        if (cart.length === 0) {
            setError("Debes añadir al menos un producto a la venta.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            for (const item of cart) {
                await api.createSale({
                    date: form.date,
                    branch_id: form.branch_id,
                    lead_id: form.lead_id,
                    client_name: form.client_name,
                    payment_method: form.payment_method,
                    seller_id: form.seller_id,
                    notes: form.notes,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    amount: item.amount,
                    product_id: item.product_id || null,
                    service_rendered: item.service_rendered,
                });
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
        setForm(prev => ({ ...prev, client_name: lead.name, lead_id: String(lead.id) }));
        setIsLeadModalOpen(false);
    };

    const canAdd = form.product_id && form.quantity && toNumber(form.quantity) > 0;
    const canSubmit = form.branch_id && form.date && form.client_name && form.lead_id && cart.length > 0;

    if (!isOpen && !isLeadModalOpen) return null;

    return (
        <>
            <LeadModal
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                onSuccess={handleLeadCreatedFromModal}
                initialBranchId={form.branch_id}
                initialName={form.client_name}
            />

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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                                    <select
                                        required
                                        disabled={!canSelectBranch || !!initialData?.branch_id}
                                        className={`w-full border rounded-lg p-2 text-sm ${(!canSelectBranch || !!initialData?.branch_id) ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""}`}
                                        value={form.branch_id}
                                        onChange={(e) => setForm(prev => ({ ...prev, branch_id: e.target.value, client_name: "", lead_id: "" }))}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={String(b.id)}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha</label>
                                    <input
                                        type="date"
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
                                            type="text"
                                            required
                                            disabled={!form.branch_id || !!initialData?.lead_id}
                                            placeholder={form.branch_id ? "Buscar en leads..." : "Elige sucursal primero"}
                                            className={`w-full border rounded-lg p-2 text-sm ${(!form.branch_id || !!initialData?.lead_id) ? "bg-gray-50 text-gray-500" : ""}`}
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
                                    <select
                                        className="w-full border rounded-lg p-2 text-sm"
                                        value={form.product_id}
                                        onChange={(e) => handleProductSelect(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar de Inventario --</option>
                                        {availableProducts.map((p: any) => (
                                            <option key={p.id} value={String(p.id)}>
                                                {p.name} {p.type !== 'service' ? `(Stock: ${p.stock})` : ''} (Price: {p.sales_price})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vendedor</label>
                                    <select
                                        className="w-full border rounded-lg p-2 text-sm"
                                        value={form.seller_id}
                                        onChange={(e) => setForm(prev => ({ ...prev, seller_id: e.target.value }))}
                                        disabled={!canViewBranch}
                                    >
                                        {users.length === 0 && <option value={user?.id}>{user?.name}</option>}
                                        {users.map(u => (
                                            <option key={u.id} value={String(u.id)}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Producto ($)</label>
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
                                    {cart.map((item, idx) => (
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
        </>
    );
};

export default CreateSaleModal;
