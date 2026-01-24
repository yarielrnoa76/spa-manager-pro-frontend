import React, { useState, useEffect } from "react";
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
} from "lucide-react";

const Stocks: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [moveType, setMoveType] = useState<"purchase" | "sale">("purchase");
  const [quantity, setQuantity] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [canDeleteProduct, setCanDeleteProduct] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    price: "0",
    stock: "0",
    min_stock: "0",
    max_stock: "0",
  });

  useEffect(() => {
    fetchData();
    (async () => {
      const me = await api.me();
      const perms: string[] =
        me?.permissions || me?.role?.permissions?.map((p: any) => p.name) || [];

      // soporta ambos nombres por si hay inconsistencia
      setCanDeleteProduct(
        perms.includes("delete_product") ||
          perms.includes("product_delete") ||
          perms.includes("Product_delete"),
      );
    })();
  }, []);

  const fetchData = async () => {
    const data = await api.listProducts(); // ✅ antes: getProducts()
    setProducts(data);
  };

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
      // refresca tabla
      fetchData();
    } catch (err: any) {
      alert(err?.message || "Error eliminando producto");
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.createProduct({
        name: newProduct.name.trim(),
        sku: newProduct.sku.trim() || null,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        min_stock: Number(newProduct.min_stock),
        max_stock: Number(newProduct.max_stock),
      });

      setIsCreateModalOpen(false);
      setNewProduct({
        name: "",
        sku: "",
        price: "0",
        stock: "0",
        min_stock: "0",
        max_stock: "0",
      });

      fetchData();
    } catch (err: any) {
      alert(err?.message || "Error creando producto");
    }
  };

  const handleStockMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      await api.moveStock({
        product_id: selectedProduct.id,
        type: moveType, // "purchase" | "sale"
        quantity: quantity, // number
      }); // ✅ antes: moveStock(id, type, qty)

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Inventario</h1>
          <p className="text-gray-500 text-sm">
            Control de stock de insumos y productos de reventa.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700"
        >
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">Total Productos</p>
              <h3 className="text-2xl font-bold mt-1">{products.length}</h3>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Package />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">Stock Bajo</p>
              <h3 className="text-2xl font-bold mt-1 text-amber-600">
                {products.filter((p) => p.is_low_stock).length}
              </h3>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">Valor Inventario</p>
              <h3 className="text-2xl font-bold mt-1">
                $
                {products
                  .reduce(
                    (acc, p) =>
                      acc + (Number(p.price) || 0) * (Number(p.stock) || 0),
                    0,
                  )
                  .toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
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

        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 font-bold text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4">Precio</th>
              <th className="px-6 py-4 text-center">Stock Actual</th>
              <th className="px-6 py-4 text-center">Stock Mínimo</th>
              <th className="px-6 py-4 text-center">Stock Máximo</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((product) => {
              const min = product.min_stock ?? "";
              const max = product.max_stock ?? "";

              return (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {product.sku || ""}
                  </td>
                  <td className="px-6 py-4 font-medium">${product.price}</td>

                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full font-bold ${
                        Number(product.stock) <= Number(product.min_stock)
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {product.stock}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center">
                    {product.min_stock ?? ""}
                  </td>

                  <td className="px-6 py-4 text-center">
                    {product.max_stock ?? ""}
                  </td>

                  <td className="px-6 py-4">
                    {product.is_low_stock ? (
                      <span className="flex items-center gap-1 text-amber-600 font-bold text-[10px] uppercase">
                        <AlertTriangle size={12} /> Stock Crítico
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold uppercase">
                        OK
                      </span>
                    )}
                  </td>

                  {/*  ÚLTIMA COLUMNA: ACCIONES */}
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setIsModalOpen(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold"
                      >
                        <ArrowRightLeft size={16} /> Movimiento
                      </button>

                      {canDeleteProduct && (
                        <button
                          onClick={() => handleDeleteProduct(product)}
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
                  className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 ${
                    moveType === "purchase"
                      ? "bg-white shadow text-indigo-600"
                      : "text-gray-500"
                  }`}
                >
                  <TrendingUp size={16} /> Entrada
                </button>

                <button
                  type="button"
                  onClick={() => setMoveType("sale")}
                  className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 ${
                    moveType === "sale"
                      ? "bg-white shadow text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  <TrendingDown size={16} /> Salida
                </button>
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
                    setNewProduct({ ...newProduct, name: e.target.value })
                  }
                />
              </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Precio
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, price: e.target.value })
                    }
                  />
                </div>

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
              </div>

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
                    value={newProduct.min_stock}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        min_stock: e.target.value,
                      })
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
    </div>
  );
};

export default Stocks;
