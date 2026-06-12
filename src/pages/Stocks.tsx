import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api";
import { Product } from "../types";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Pencil,
  Download,
  Upload,
} from "lucide-react";
import ImportProductsModal from "../components/ImportProductsModal";

const Stocks: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [moveType, setMoveType] = useState<"purchase" | "sale">("purchase");
  const [quantity, setQuantity] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [canDeleteProduct, setCanDeleteProduct] = useState(false);

  // Productos nuevos
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    type: "product" as "product" | "service",
    sales_price: "0",
    cost_price: "0",
    stock: "0",
    min_stock: "",
    max_stock: "",
  });
  // ditar Productos
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    type: "product" as "product" | "service",
    sales_price: "0",
    cost_price: "0",
    min_stock: "0",
    max_stock: "0",
  });

  // precios en modal de movimiento (editables según tipo)
  const [moveSalesPrice, setMoveSalesPrice] = useState<string>("0");
  const [moveCostPrice, setMoveCostPrice] = useState<string>("0");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const exportToCSV = () => {
    const headers = ["Nombre", "SKU", "Tipo", "Precio Venta", "Precio Costo", "Stock Actual", "Stock Minimo", "Stock Maximo"].join(",");
    const rows = products.map((p) => {
      const name = p.name || "";
      const sku = p.sku || "";
      const type = p.type === "service" ? "servicio" : "producto";
      const salesPrice = p.sales_price || 0;
      const costPrice = p.cost_price || 0;
      const stock = p.type === "service" ? "" : (p.stock || 0);
      const minStock = p.type === "service" ? "" : (p.min_stock || 0);
      const maxStock = p.type === "service" ? "" : (p.max_stock ?? "");

      return [
        name,
        sku,
        type,
        salesPrice,
        costPrice,
        stock,
        minStock,
        maxStock
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
    });

    const blob = new Blob([headers + "\n" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;"
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const todayStr = new Date().toISOString().slice(0, 10);
    a.download = `inventario_export_${todayStr}.csv`;
    a.click();
  };

  const fetchData = useCallback(async () => {
    const [data, profs] = await Promise.all([
      api.listProducts(),
      api.listProfessionals().catch(() => [])
    ]);
    setProducts(data);
    setProfessionals(profs);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      const me = await api.me();
      const perms: string[] =
        me?.permissions || me?.role?.permissions?.map((p: any) => p.name) || [];

      const isAdmin = me?.role?.name === "superadmin" || me?.is_super_admin === true;

      setCanDeleteProduct(
        isAdmin ||
        perms.includes("delete_product") ||
        perms.includes("product_delete") ||
        perms.includes("Product_delete")
      );
    })();
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoveSalesPrice(String(selectedProduct.sales_price ?? 0));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoveCostPrice(String(selectedProduct.cost_price ?? 0));
  }, [selectedProduct]);

  useEffect(() => {
    // cuando cambia de entrada/salida, mantenemos valores actuales del producto
    if (!selectedProduct) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoveSalesPrice(String(selectedProduct.sales_price ?? 0));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoveCostPrice(String(selectedProduct.cost_price ?? 0));
  }, [moveType, selectedProduct]);


  const handleDeleteProduct = async (product: Product) => {
    if (!canDeleteProduct) {
      alert("No tienes permiso para eliminar productos.");
      return;
    }

    const ok = window.confirm(
      `¿Seguro que deseas eliminar el producto "${product.name}"?\n\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;

    try {
      await api.deleteProduct(product.id);
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Error eliminando producto");
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const isService = newProduct.type === "service";

      const payload: any = {
        name: newProduct.name.trim(),
        sku: newProduct.sku.trim() || null,
        type: newProduct.type,
        sales_price: Number(newProduct.sales_price),
        cost_price: Number(newProduct.cost_price),
        professional_ids: (newProduct as any).professional_ids || [],
      };

      if (!isService) {
        payload.stock = Math.max(0, Math.trunc(Number(newProduct.stock)));
        payload.min_stock = Math.max(0, Math.trunc(Number(newProduct.min_stock)));

        const ms = String(newProduct.max_stock ?? "").trim();
        if (ms === "" || Number(ms) === 0) {
          payload.max_stock = null;
        } else {
          payload.max_stock = Math.max(0, Math.trunc(Number(ms)));
        }
      } else {
        payload.stock = 0;
        payload.min_stock = 0;
        payload.max_stock = null;
      }

      await api.createProduct(payload);

      setIsCreateModalOpen(false);
      setNewProduct({
        name: "",
        sku: "",
        type: "product",
        sales_price: "0",
        cost_price: "0",
        stock: "0",
        min_stock: "0",
        max_stock: "0",
        professional_ids: [],
      } as any);

      fetchData();
    } catch (err: any) {
      console.log("CREATE PRODUCT ERROR =>", err);
      alert(err?.message || "Error creando producto");
    }
  };

  const openEditModal = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      name: p.name ?? "",
      sku: p.sku ?? "",
      type: p.type ?? "product",
      sales_price: String(p.sales_price ?? 0),
      cost_price: String(p.cost_price ?? 0),
      min_stock: String(p.min_stock ?? 0),
      max_stock:
        p.max_stock === null || p.max_stock === undefined
          ? ""
          : String(p.max_stock),
      professional_ids: p.professionals?.map(prof => prof.id) || [],
    } as any);
    setIsEditModalOpen(true);
  };

  const toNum = (v: string) => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    try {
      const payload: any = {
        name: editForm.name.trim(),
        sku: editForm.sku.trim() || null,
        type: editForm.type,
        sales_price: toNum(editForm.sales_price),
        cost_price: toNum(editForm.cost_price),
        min_stock: Math.max(0, Math.trunc(toNum(editForm.min_stock))),
        professional_ids: (editForm as any).professional_ids || [],
      };

      // ✅ max_stock: si está vacío o "0" => null
      const ms = String(editForm.max_stock ?? "").trim();
      if (ms === "" || toNum(ms) === 0) {
        payload.max_stock = null;
      } else {
        payload.max_stock = Math.max(0, Math.trunc(toNum(ms)));
      }

      await api.updateProduct(editProduct.id, payload);

      setIsEditModalOpen(false);
      setEditProduct(null);
      fetchData();
    } catch (err: any) {
      // ✅ para ver el detalle real de la validación
      console.log("UPDATE PRODUCT ERROR =>", err);
      alert(err?.message || "Error actualizando producto");
    }
  };

  const handleStockMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      const payload: any = {
        product_id: selectedProduct.id,
        type: moveType,
        quantity: quantity,
      };

      // Siempre se puede enviar sales_price (ambos casos, editable en ambos)
      payload.sales_price = Number(moveSalesPrice);

      // cost_price solo editable/aplicable en entrada
      if (moveType === "purchase") {
        payload.cost_price = Number(moveCostPrice);
      }

      await api.moveStock(payload);

      setIsModalOpen(false);
      setSelectedProduct(null);
      setQuantity(1);
      setMoveType("purchase");
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Error moviendo stock");
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Inventario</h1>
          <p className="text-gray-500 text-sm">
            Control de productos para la venta.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-white text-sm font-bold hover:bg-gray-50 text-gray-700 cursor-pointer shadow-sm"
          >
            <Upload size={18} /> Importar CSV
          </button>
          <button
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-white text-sm font-bold hover:bg-gray-50 text-gray-700 cursor-pointer shadow-sm"
          >
            <Download size={18} /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700"
          >
            <Plus size={18} /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-3 md:gap-6 pb-2 snap-x shrink-0">
        <div className="min-w-[160px] md:min-w-0 snap-start bg-white p-4 md:p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs md:text-sm">Total Productos</p>
              <h3 className="text-xl md:text-2xl font-bold mt-1">{products.length}</h3>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Package className="w-5 h-5 md:w-6 md:h-6" />
            </div>
          </div>
        </div>

        <div className="min-w-[160px] md:min-w-0 snap-start bg-white p-4 md:p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs md:text-sm">Stock Bajo</p>
              <h3 className="text-xl md:text-2xl font-bold mt-1 text-amber-600">
                {products.filter((p) => p.is_low_stock).length}
              </h3>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
            </div>
          </div>
        </div>

        <div className="min-w-[160px] md:min-w-0 snap-start bg-white p-4 md:p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs md:text-sm">Valor Inventario</p>
              <h3 className="text-xl md:text-2xl font-bold mt-1">
                $
                {products
                  .reduce(
                    (acc, p) =>
                      acc +
                      (Number(p.cost_price) || 0) * (Number(p.stock) || 0),
                    0,
                  )
                  .toLocaleString()}
              </h3>
              <p className="text-[9px] md:text-[11px] text-gray-400 mt-0.5 md:mt-1">
                (calculado por Cost Price)
              </p>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div className="p-4 border-b flex gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-auto min-h-[300px] max-h-[60vh]">
          <table className="w-full text-left text-sm relative min-w-max">
            <thead className="bg-gray-50 font-bold text-gray-500 uppercase text-xs sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Sales Price</th>
              <th className="px-6 py-4">Cost Price</th>
              <th className="px-6 py-4 text-center">Stock Actual</th>
              <th className="px-6 py-4 text-center">Stock Mínimo</th>
              <th className="px-6 py-4 text-center">Stock Máximo</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((product) => {
              return (
                <tr
                  key={product.id}
                  onClick={() => openEditModal(product)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {product.sku || ""}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-full ${product.type === 'service' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {product.type === 'service' ? 'Servicio' : 'Producto'}
                      </span>
                      {product.type === 'service' && product.professionals && product.professionals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 max-w-[150px]">
                           {product.professionals.map(p => (
                               <span key={p.id} className="text-[9px] px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-600 border border-gray-200" title={p.title}>
                                   {p.fname} {p.lname}
                               </span>
                           ))}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 font-medium">
                    ${product.sales_price}
                  </td>

                  <td className="px-6 py-4 text-gray-500">
                    ${product.cost_price}
                  </td>

                  <td className="px-6 py-4 text-center">
                    {product.type === 'service' ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full font-bold ${Number(product.stock) < Number(product.min_stock)
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                          }`}
                      >
                        {product.stock}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-center">
                    {product.type === 'service' ? <span className="text-gray-400">-</span> : (product.min_stock ?? "")}
                  </td>

                  <td className="px-6 py-4 text-center">
                    {product.type === 'service' ? <span className="text-gray-400">-</span> : (product.max_stock ?? "")}
                  </td>

                  <td className="px-6 py-4">
                    {product.type === 'service' ? (
                      <span className="text-[10px] text-gray-400 font-bold uppercase">-</span>
                    ) : product.is_low_stock ? (
                      <span className="flex items-center gap-1 text-amber-600 font-bold text-[10px] uppercase">
                        <AlertTriangle size={12} /> Stock Crítico
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold uppercase">
                        OK
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3">
                      {/* ✅ EDITAR */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(product);
                        }}
                        className="text-gray-700 hover:text-gray-900 flex items-center gap-1 font-bold"
                      >
                        <Pencil size={16} /> Editar
                      </button>

                      {/* MOVIMIENTO */}
                      {product.type !== 'service' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setIsModalOpen(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold"
                        >
                          <ArrowRightLeft size={16} /> Mover
                        </button>
                      )}

                      {/* ELIMINAR */}
                      {canDeleteProduct && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(product);
                          }}
                          className="text-red-600 hover:text-red-800 font-bold"
                          title="Eliminar producto"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex justify-between">
              <div>
                <h3 className="font-bold text-lg">Actualizar Stock</h3>
                <p className="text-xs text-gray-500">{selectedProduct.name}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleStockMove} className="p-6 space-y-6">
              <div className="flex p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMoveType("purchase")}
                  className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 ${moveType === "purchase"
                    ? "bg-white shadow text-indigo-600"
                    : "text-gray-500"
                    }`}
                >
                  <TrendingUp size={16} /> Entrada
                </button>

                <button
                  type="button"
                  onClick={() => setMoveType("sale")}
                  className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 ${moveType === "sale"
                    ? "bg-white shadow text-red-600"
                    : "text-gray-500"
                    }`}
                >
                  <TrendingDown size={16} /> Salida
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full border rounded-lg p-3 text-sm font-bold ${moveType === "sale" ? "bg-gray-100 text-gray-500" : ""
                      }`}
                    value={moveCostPrice}
                    disabled={moveType === "sale"} // en salida no se puede
                    onChange={(e) => setMoveCostPrice(e.target.value)}
                  />
                  {moveType === "sale" && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      En salida no se permite modificar Cost Price.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Sales Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border rounded-lg p-3 text-sm font-bold"
                    value={moveSalesPrice}
                    onChange={(e) => setMoveSalesPrice(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Cantidad
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  className="w-full border rounded-lg p-3 text-lg font-bold text-center"
                  value={quantity === 0 ? "" : quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setQuantity(0);
                    } else if (/^\d+$/.test(val)) {
                      setQuantity(parseInt(val, 10));
                    }
                  }}
                />
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg flex justify-between items-center text-sm">
                <span className="text-indigo-700">Stock Resultante:</span>
                <span className="font-bold text-indigo-900 text-lg">
                  {moveType === "purchase"
                    ? selectedProduct.stock + quantity
                    : selectedProduct.stock - quantity}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Editar Producto</h3>
                <p className="text-xs text-gray-500">{editProduct.name}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Nombre
                </label>
                <input
                  required
                  className="w-full border rounded-lg p-2 text-sm"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    SKU (opcional)
                  </label>
                  <input
                    className="w-full border rounded-lg p-2 text-sm"
                    value={editForm.sku}
                    onChange={(e) =>
                      setEditForm({ ...editForm, sku: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Tipo
                  </label>
                  <select
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    value={editForm.type}
                    onChange={(e) =>
                      setEditForm({ ...editForm, type: e.target.value as "product" | "service" })
                    }
                  >
                    <option value="product">Producto</option>
                    <option value="service">Servicio</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={editForm.cost_price}
                    onChange={(e) =>
                      setEditForm({ ...editForm, cost_price: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Sales Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={editForm.sales_price}
                    onChange={(e) =>
                      setEditForm({ ...editForm, sales_price: e.target.value })
                    }
                  />
                </div>
              </div>

              {editForm.type === 'product' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Min stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      className="w-full border rounded-lg p-2 text-sm"
                      value={editForm.min_stock}
                      onChange={(e) =>
                        setEditForm({ ...editForm, min_stock: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Max stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={editForm.max_stock}
                      onChange={(e) =>
                        setEditForm({ ...editForm, max_stock: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {editForm.type === 'service' && professionals.length > 0 && (
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          Profesionales Habilitados
                      </label>
                      <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto bg-gray-50">
                          {professionals.map(prof => {
                              const isSelected = ((editForm as any).professional_ids || []).includes(prof.id);
                              return (
                                  <label key={prof.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                                      <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={(e) => {
                                              const current = (editForm as any).professional_ids || [];
                                              if (e.target.checked) {
                                                  setEditForm({ ...editForm, professional_ids: [...current, prof.id] } as any);
                                              } else {
                                                  setEditForm({ ...editForm, professional_ids: current.filter((id: number) => id !== prof.id) } as any);
                                              }
                                          }}
                                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="font-medium text-gray-700">{prof.fname} {prof.lname}</span>
                                      <span className="text-xs text-gray-400">({prof.title})</span>
                                  </label>
                              );
                          })}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Selecciona qué profesionales pueden realizar este servicio.</p>
                  </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 border rounded-lg font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Nuevo Producto</h3>
                <p className="text-xs text-gray-500">
                  Crea un producto con stock y límites.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Nombre
                </label>
                <input
                  required
                  className="w-full border rounded-lg p-2 text-sm"
                  value={newProduct.name}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, name: e.target.value } as any)
                  }
                />
                </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    SKU (opcional)
                  </label>
                  <input
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newProduct.sku}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, sku: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Tipo
                  </label>
                  <select
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                    value={newProduct.type}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, type: e.target.value as "product" | "service" })
                    }
                  >
                    <option value="product">Producto</option>
                    <option value="service">Servicio</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newProduct.cost_price}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        cost_price: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Sales Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newProduct.sales_price}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        sales_price: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Stock fields only for products */}
              {newProduct.type === "product" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Stock inicial
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full border rounded-lg p-2 text-sm"
                        value={newProduct.stock}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, stock: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Min stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full border rounded-lg p-2 text-sm"
                        value={newProduct.min_stock}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            min_stock: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Max stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full border rounded-lg p-2 text-sm"
                        value={newProduct.max_stock}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            max_stock: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {newProduct.type === 'service' && professionals.length > 0 && (
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                          Profesionales Habilitados
                      </label>
                      <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto bg-gray-50">
                          {professionals.map(prof => {
                              const isSelected = ((newProduct as any).professional_ids || []).includes(prof.id);
                              return (
                                  <label key={prof.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 p-1 rounded">
                                      <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={(e) => {
                                              const current = (newProduct as any).professional_ids || [];
                                              if (e.target.checked) {
                                                  setNewProduct({ ...newProduct, professional_ids: [...current, prof.id] } as any);
                                              } else {
                                                  setNewProduct({ ...newProduct, professional_ids: current.filter((id: number) => id !== prof.id) } as any);
                                              }
                                          }}
                                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <span className="font-medium text-gray-700">{prof.fname} {prof.lname}</span>
                                      <span className="text-xs text-gray-400">({prof.title})</span>
                                  </label>
                              );
                          })}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">Selecciona qué profesionales pueden realizar este servicio.</p>
                  </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2 border rounded-lg font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <ImportProductsModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default Stocks;
