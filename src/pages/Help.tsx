import React, { useState } from 'react';
import {
    HelpCircle, Ticket, Calendar, Package, DollarSign, UserPlus,
    ChevronDown, ChevronUp, BookOpen, Info, MessageSquare,
    Search, ExternalLink, ArrowRight, Settings, Activity,
    BarChart3, Bell, Radio, Shield, Key, Link, Globe2
} from 'lucide-react';

type ModuleKey = 'dashboard' | 'tickets' | 'appointments' | 'inventory' | 'sales' | 'leads' | 'communication' | 'audit' | 'settings' | 'notifications';

interface HelpSectionProps {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const HelpSection: React.FC<HelpSectionProps> = ({ title, icon: Icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4 transition-all hover:border-indigo-100">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Icon size={20} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
                </div>
                {isOpen ? <ChevronUp className="text-gray-400" size={20} /> : <ChevronDown className="text-gray-400" size={20} />}
            </button>

            {isOpen && (
                <div className="px-5 pb-6 pt-2">
                    <div className="pl-14 text-gray-600 leading-relaxed space-y-4 pr-4">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

const Help: React.FC = () => {
    const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');

    const menuItems: { id: ModuleKey; label: string; icon: React.ElementType; color: string }[] = [
        { id: 'dashboard', label: 'Panel de Control', icon: BarChart3, color: 'text-cyan-600 bg-cyan-50' },
        { id: 'tickets', label: 'Tickets', icon: Ticket, color: 'text-blue-600 bg-blue-50' },
        { id: 'appointments', label: 'Citas', icon: Calendar, color: 'text-purple-600 bg-purple-50' },
        { id: 'inventory', label: 'Inventario', icon: Package, color: 'text-amber-600 bg-amber-50' },
        { id: 'sales', label: 'Ventas Diarias', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
        { id: 'leads', label: 'Contactos / Leads', icon: UserPlus, color: 'text-indigo-600 bg-indigo-50' },
        { id: 'communication', label: 'Live Chat', icon: Radio, color: 'text-teal-600 bg-teal-50' },
        { id: 'audit', label: 'Auditoría / Logs', icon: Activity, color: 'text-slate-600 bg-slate-50' },
        { id: 'settings', label: 'Configuración', icon: Settings, color: 'text-rose-600 bg-rose-50' },
        { id: 'notifications', label: 'Notificaciones', icon: Bell, color: 'text-orange-600 bg-orange-50' },
    ];

    return (
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
            {/* SIDEBAR MENU */}
            <aside className="w-full md:w-72 shrink-0 space-y-6">
                <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg shadow-indigo-100 text-white relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
                        <HelpCircle size={100} />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight mb-1 relative z-10">Centro de Ayuda</h1>
                    <p className="text-indigo-100 text-sm font-medium relative z-10 opacity-80">Guía completa del sistema</p>
                </div>

                <nav className="space-y-1">
                    <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Módulos del Sistema</p>
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveModule(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all text-sm group ${activeModule === item.id
                                ? 'bg-white shadow-sm border border-gray-100 text-indigo-600'
                                : 'text-gray-500 hover:bg-gray-100/50 hover:text-gray-800'
                                }`}
                        >
                            <div className={`p-2 rounded-xl transition-colors ${activeModule === item.id ? item.color : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                                }`}>
                                <item.icon size={18} />
                            </div>
                            {item.label}
                            {activeModule === item.id && <ArrowRight size={14} className="ml-auto opacity-50" />}
                        </button>
                    ))}
                </nav>

                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                        <Search size={16} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">¿Dudas rápidas?</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-normal">
                        Si no encuentra lo que busca, no olvide consultar con su administrador del sistema.
                    </p>
                </div>
            </aside>

            {/* CONTENT AREA */}
            <main className="flex-1 min-w-0 pb-12">
                <div className="bg-white rounded-[2rem] p-8 min-h-[600px] border border-gray-100 shadow-sm relative overflow-hidden">

                    {/* DASHBOARD HELP */}
                    {activeModule === 'dashboard' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-cyan-50 text-cyan-600 rounded-2xl">
                                    <BarChart3 size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Panel de Control</h2>
                                    <p className="text-sm text-gray-500 font-medium">Resumen de actividad y rendimiento del negocio</p>
                                </div>
                            </header>

                            <HelpSection title="Vista General" icon={Info} defaultOpen={true}>
                                <p>El Dashboard es la primera pantalla al ingresar al sistema. Presenta un resumen ejecutivo del rendimiento de su negocio con datos actualizados en tiempo real.</p>
                                <p className="mt-2 text-sm">Toda la información se calcula dinámicamente basándose en los filtros seleccionados.</p>
                            </HelpSection>

                            <HelpSection title="Filtros del Dashboard" icon={ExternalLink}>
                                <p>En la esquina superior derecha encontrará 3 selectores combinables:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Sucursal:</strong> Vea datos de todas las sucursales o aísle una específica.</li>
                                    <li><strong>Mes:</strong> Seleccione un mes particular o elija "Todos" para ver el acumulado del año completo.</li>
                                    <li><strong>Año:</strong> Navegue entre los últimos 6 años y el siguiente.</li>
                                </ul>
                                <p className="mt-3 text-sm text-gray-500">Si selecciona el mes y año actual, los datos se calculan hasta el día de hoy.</p>
                            </HelpSection>

                            <HelpSection title="Tarjetas de Indicadores (KPIs)" icon={ExternalLink}>
                                <p>El panel muestra 4 tarjetas principales actualizadas según el período seleccionado:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-indigo-600">Valor de Ventas</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Total monetario de ventas activas en el período.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-emerald-600">Ganancia Neta</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Ingresos menos costo de los productos vendidos (calculado con Cost Price).</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-amber-600">Cantidad de Ventas</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Número de transacciones activas realizadas.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-rose-600">Productos Vendidos</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Suma de unidades vendidas en todas las transacciones.</p>
                                    </div>
                                </div>
                            </HelpSection>

                            <HelpSection title="Gráficos" icon={ExternalLink}>
                                <p>El Dashboard incluye 3 gráficos de barras interactivos:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Ventas por Día/Mes:</strong> Cuando se selecciona un mes específico, muestra barras por día. Al elegir "Todos", muestra el conteo mensual del año.</li>
                                    <li><strong>Ventas por Vendedora:</strong> Ranking de rendimiento del equipo de ventas ordenado de mayor a menor.</li>
                                    <li><strong>Top 10 Productos:</strong> Los productos más vendidos del período en formato horizontal, ordenados por cantidad de unidades.</li>
                                </ul>
                                <p className="mt-3 text-sm text-gray-500">Todos los gráficos excluyen automáticamente las ventas canceladas para mostrar únicamente datos reales.</p>
                            </HelpSection>
                        </div>
                    )}

                    {/* TICKETS HELP */}
                    {activeModule === 'tickets' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                                    <Ticket size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Módulo de Tickets</h2>
                                    <p className="text-sm text-gray-500 font-medium">Gestión de soporte y seguimiento</p>
                                </div>
                            </header>

                            <HelpSection title="Conceptos Básicos" icon={Info} defaultOpen={true}>
                                <p>El sistema de Tickets centraliza todas las solicitudes. Cada ticket tiene un ciclo de vida definido:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-blue-600">Nuevo</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Solicitudes pendientes de atención.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-amber-600">En Proceso</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">El responsable ya está trabajando.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-green-600">Completado</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">El caso fue resuelto satisfactoriamente.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-red-600">Cancelado</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Requiere motivo obligatorio al cancelar.</p>
                                    </div>
                                </div>
                            </HelpSection>

                            <HelpSection title="Pestañas del Módulo" icon={ExternalLink}>
                                <p>El módulo de Tickets se organiza en 3 vistas internas accesibles desde las pestañas superiores:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Dashboard:</strong> Resumen con 4 tarjetas de estadísticas (Total, Nuevos, En Proceso, Vencidos) y lista rápida de los tickets más recientes.</li>
                                    <li><strong>Listado de Tickets:</strong> Tabla completa con filtros por estado, categoría, búsqueda de texto y un botón para ver solo los vencidos. Al seleccionar un ticket, se abre un panel lateral con toda su información, acciones de estado y sección de <strong>Comentarios</strong>.</li>
                                    <li><strong>Configuración Admin:</strong> Gestión de categorías de ticket y prioridades/SLA disponibles en el sistema.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Asignación Round Robin" icon={ExternalLink}>
                                <p>Los tickets automáticos se distribuyen de forma justa:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-2">
                                    <li>Se selecciona al vendedor con <strong>menos carga actual</strong>.</li>
                                    <li>En caso de empate, al que lleva <strong>más tiempo sin recibir asignación</strong>.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Niveles de Servicio (SLA)" icon={ExternalLink}>
                                <p>Tiempo máximo de respuesta basado en la prioridad del ticket:</p>
                                <div className="flex gap-4 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                                    <span className="shrink-0 px-3 py-1.5 bg-red-100 text-red-700 text-[10px] font-black rounded-lg">URGENTE: 30M</span>
                                    <span className="shrink-0 px-3 py-1.5 bg-orange-100 text-orange-700 text-[10px] font-black rounded-lg">ALTA: 2H</span>
                                    <span className="shrink-0 px-3 py-1.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg">MEDIA: 8H</span>
                                </div>
                                <p className="mt-3 text-sm text-gray-500">Los tickets que superen su tiempo de SLA aparecerán marcados como <strong className="text-red-500">VENCIDO</strong> en la tabla junto a su fecha de vencimiento en rojo.</p>
                            </HelpSection>

                            <HelpSection title="Creación de Tickets" icon={Info}>
                                <p>Al crear un nuevo ticket, ya sea desde el módulo global o directamente dentro del panel de un Lead (pestaña Tickets), el usuario debe proveer los siguientes campos esenciales:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Asunto:</strong> Título breve que describe el problema o requerimiento.</li>
                                    <li><strong>Categoría:</strong> Tipo de solicitud (ej. Soporte, Ventas, Queja).</li>
                                    <li><strong>Prioridad:</strong> Define el nivel de urgencia y los tiempos del SLA.</li>
                                    <li><strong>Descripción:</strong> (Opcional) Detalles extendidos del caso.</li>
                                    <li><strong>Responsable:</strong> (Opcional) No es necesario asignarlo manualmente si desea delegarlo al sistema automático de Round Robin. Si se elige de forma manual, el sistema respetará esa asignación en lugar de delegarlo.</li>
                                    <li><strong>Vencimiento:</strong> (Opcional) Fecha y hora límite personalizada.</li>
                                </ul>
                                <p className="mt-4 text-sm text-gray-500"><strong>Nota:</strong> Los demás datos como el código de ticket único, estado inicial (New), fechas de creación, cliente y sucursal, son detectados y llenados automáticamente por el sistema.</p>
                            </HelpSection>

                            <HelpSection title="Detalle y Comentarios" icon={MessageSquare}>
                                <p>Al seleccionar un ticket del listado, se despliega un panel lateral con:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Información General:</strong> Asunto, descripción, categoría, prioridad, Lead asociado, origen (manual o sistema) y fechas.</li>
                                    <li><strong>Acciones de Estado:</strong> Botones para "Empezar a Tratar", "Finalizar" o "Cancelar" según el estado actual. La cancelación exige un <strong className="text-red-500">motivo obligatorio</strong> antes de confirmarse.</li>
                                    <li><strong>Reasignación:</strong> Puede cambiar el responsable del ticket en cualquier momento desde el selector de usuarios.</li>
                                    <li><strong>Comentarios:</strong> Historial de notas del equipo. Para agregar un comentario, escriba en el campo de texto y presione <strong>Enter</strong>.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                    {/* APPOINTMENTS HELP */}
                    {activeModule === 'appointments' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
                                    <Calendar size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Citas / Agenda</h2>
                                    <p className="text-sm text-gray-500 font-medium">Control de servicios y disponibilidad</p>
                                </div>
                            </header>

                            <HelpSection title="Agendamiento de Citas" icon={Info} defaultOpen={true}>
                                <p>Para agendar una cita correctamente siga estos pasos:</p>
                                <ol className="list-decimal pl-5 space-y-2 mt-4">
                                    <li>Seleccione un <strong>Lead o Cliente</strong> de la base de datos.</li>
                                    <li>Elija el <strong>Servicio</strong> que desea realizar.</li>
                                    <li>Defina la <strong>Sucursal</strong> y la <strong>Fecha/Hora</strong>.</li>
                                    <li>El sistema verificará la disponibilidad en el calendario.</li>
                                </ol>
                            </HelpSection>

                            <HelpSection title="Creación de Citas" icon={Info}>
                                <p>Al crear una nueva cita, el usuario puede proporcionar los siguientes datos:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Fecha y Hora:</strong> Momento programado para el servicio.</li>
                                    <li><strong>Nombre del Cliente:</strong> Nombre o identificador del cliente (texto libre o autocompletado si proviene de un Lead).</li>
                                    <li><strong>Teléfono / Email:</strong> Datos de contacto importantes. Obligatorios si la cita se enlaza a un perfil de Lead existente para mantener la ficha actualizada.</li>
                                    <li><strong>Servicio a realizar:</strong> Menú desplegable con los tratamientos y servicios activos en el sistema.</li>
                                    <li><strong>Sucursal:</strong> Ubicación donde se llevará a cabo el servicio.</li>
                                    <li><strong>Notas:</strong> (Opcional) Cualquier detalle relevante a tener en cuenta antes de la llegada del cliente.</li>
                                </ul>
                                <p className="mt-4 text-sm text-gray-500"><strong>Nota:</strong> Si los datos de contacto coinciden con un cliente existente, el sistema le ofrecerá vincular automáticamente la cita a su historial (su "Lead"), manteniendo su perfil enriquecido. Si no, se creará un perfil nuevo en el fondo.</p>
                            </HelpSection>

                            <HelpSection title="Estados de la Cita" icon={ExternalLink}>
                                <p>Mantenga actualizada su agenda marcando el estado correcto:</p>
                                <ul className="list-none space-y-3 mt-4">
                                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-500"></div> <strong>Confirmada:</strong> El cliente aseguró asistencia.</li>
                                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-green-500"></div> <strong>Completada:</strong> El servicio fue realizado y facturado.</li>
                                    <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-red-500"></div> <strong>Cancelada:</strong> El espacio queda liberado.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                    {/* INVENTORY HELP */}
                    {activeModule === 'inventory' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
                                    <Package size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Inventario / Stocks</h2>
                                    <p className="text-sm text-gray-500 font-medium">Control de productos y existencias</p>
                                </div>
                            </header>

                            <HelpSection title="Gestión de Productos" icon={Info} defaultOpen={true}>
                                <p>Cada producto cuenta con una ficha técnica que incluye: Nombre, SKU, Precio de Costo (<em>Cost Price</em>), Precio de Venta (<em>Sales Price</em>), Stock actual, Stock mínimo y Stock máximo.</p>
                                <p className="mt-2 text-sm">Use el buscador por nombre o SKU para encontrar productos rápidamente.</p>
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-4 mt-4">
                                    <Info className="text-amber-600 shrink-0" size={20} />
                                    <p className="text-sm text-amber-900"><strong>Dato importante:</strong> El stock se descuenta automáticamente al finalizar una venta, ahorrando control dual para el almacén.</p>
                                </div>
                            </HelpSection>

                            <HelpSection title="Tarjetas Resumen" icon={ExternalLink}>
                                <p>En la parte superior del módulo encontrará 3 indicadores actualizados en tiempo real:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Total Productos:</strong> Cantidad de artículos registrados en el catálogo.</li>
                                    <li><strong>Stock Bajo:</strong> Productos cuya existencia está por debajo del mínimo configurado (marcados con icono de alerta naranja).</li>
                                    <li><strong>Valor Inventario:</strong> Suma calculada mediante <em>Cost Price × Stock</em> de cada producto, dando el valor total de su bodega.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Movimientos de Stock (Entrada/Salida)" icon={ExternalLink}>
                                <p>Use el botón <strong>"Mover"</strong> en la fila de un producto para registrar una operación:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Entrada (Compra):</strong> Incrementa el stock. Puede actualizar tanto el <em>Cost Price</em> como el <em>Sales Price</em> durante la entrada.</li>
                                    <li><strong>Salida (Venta manual):</strong> Reduce el stock. En este modo el <em>Cost Price</em> se bloquea (solo lectura) y solo se puede ajustar el <em>Sales Price</em>.</li>
                                </ul>
                                <p className="mt-2 text-sm text-gray-500">El sistema muestra en pantalla el <strong>Stock Resultante</strong> antes de confirmar.</p>
                            </HelpSection>

                            <HelpSection title="Edición y Eliminación" icon={ExternalLink}>
                                <p>Cada producto se puede <strong>Editar</strong> (modificar nombre, SKU, precios y rangos de stock) o <strong>Eliminar</strong> si el usuario tiene el permiso <em>delete_product</em>. La eliminación solicita confirmación explícita y es irreversible.</p>
                            </HelpSection>
                        </div>
                    )}

                    {/* SALES HELP */}
                    {activeModule === 'sales' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                                    <DollarSign size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Ventas Diarias</h2>
                                    <p className="text-sm text-gray-500 font-medium">Control de ingresos y transacciones</p>
                                </div>
                            </header>

                            <HelpSection title="Registro de Ventas" icon={Info} defaultOpen={true}>
                                <p>En este módulo se registran todos los ingresos diarios por sucursal:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Zelle:</strong> Es el método de pago predeterminado al generar transacciones, pero usted puede registrar compras para otros métodos opcionales sin problema.</li>
                                    <li><strong>Estados de la Operación:</strong> De forma interna la aplicación categoriza la venta según los cambios que usted realice, nombrándolas: "<span className="font-bold text-emerald-600">NUEVA VENTA</span>", "<span className="font-bold text-amber-600">VENTA MODIFICADA</span>" o "<span className="font-bold text-red-600">VENTA ELIMINADA</span>" preservando siempre la transparencia económica de lo sucedido.</li>
                                    <li><strong>Detalle:</strong> Puede agregar notas para identificar ventas especiales o devoluciones.</li>
                                    <li><strong>Autocompletado de Cliente:</strong> Al escribir el nombre del cliente, el sistema sugiere Leads existentes de la sucursal seleccionada para vincular la venta directamente a su historial.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Filtros y Visibilidad" icon={ExternalLink}>
                                <p>La tabla de ventas ofrece varios filtros simultáneos para localizar sus registros:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Fecha:</strong> Selector de día específico. Solo puede seleccionar hasta la fecha de hoy.</li>
                                    <li><strong>Sucursal:</strong> Filtre por ubicación o vea todas a la vez.</li>
                                    <li><strong>Estado:</strong> Alterne entre <em>Activas</em>, <em>Todas</em> (incluye canceladas) o solo <em>Canceladas</em>.</li>
                                    <li><strong>Búsqueda:</strong> Filtre por nombre de cliente o servicio rendido.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Cancelar y Exportar" icon={ExternalLink}>
                                <p>Funcionalidades complementarias del módulo:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Cancelar Venta:</strong> Use el botón "Cancelar" en la fila de una venta activa. Esto ejecuta un <em>soft-delete</em> y <strong>restaura automáticamente el inventario</strong> del producto asociado. Las ventas canceladas aparecen atenuadas y etiquetadas.</li>
                                    <li><strong>Exportar CSV:</strong> El botón "Exportar" descarga un archivo CSV con las ventas visibles según los filtros aplicados (fecha, sucursal, búsqueda). Ideal para cuadres de caja.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Detalle de Venta (Modal)" icon={ExternalLink}>
                                <p>Al hacer clic en una venta activa, se abre un modal completo organizado en pestañas:</p>

                                <p className="mt-4 font-bold text-gray-800">Pestaña «Detalles de la Venta»</p>
                                <ul className="list-disc pl-5 space-y-2 mt-2 text-sm">
                                    <li><strong>Datos del Cliente (Lead):</strong> En la parte superior se muestra una tarjeta con el nombre, teléfono y email del Lead vinculado a la venta.</li>
                                    <li><strong>Edición (con permiso <em>edit_sale</em>):</strong> Si su rol tiene el permiso correspondiente, podrá modificar la <em>Fecha</em>, el <em>Método de Pago</em> y las <em>Notas</em> de la venta. Los campos de Sucursal, Producto/Servicio, Cantidad y Monto permanecen bloqueados por integridad.</li>
                                    <li><strong>Solo Lectura (sin permiso):</strong> Si no posee el permiso <em>edit_sale</em>, el modal muestra todos los datos en modo de solo lectura con un indicador <span className="font-bold text-amber-600">🔒</span> que lo señala claramente.</li>
                                </ul>

                                <p className="mt-4 font-bold text-gray-800">Pestaña «Citas» (requiere permiso <em>view_appointments</em>)</p>
                                <ul className="list-disc pl-5 space-y-2 mt-2 text-sm">
                                    <li>Muestra todas las citas registradas del Lead asociado a la venta, con fecha, servicio y estado.</li>
                                    <li>El botón <strong>«Crear Cita»</strong> abre el formulario de nueva cita <strong>pre-llenando automáticamente</strong> el nombre del cliente, teléfono, email, sucursal y servicio de la venta.</li>
                                </ul>

                                <p className="mt-4 font-bold text-gray-800">Pestaña «Tickets» (requiere permiso <em>view_ticket</em>)</p>
                                <ul className="list-disc pl-5 space-y-2 mt-2 text-sm">
                                    <li>Lista los tickets del Lead vinculado, indicando asunto, fecha, prioridad y estado.</li>
                                    <li>El botón <strong>«Crear Ticket»</strong> genera un ticket cuyo asunto y descripción referencia automáticamente el número de la venta (ej: "Ticket relacionado con Venta #123"), facilitando la trazabilidad.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Resumen del Día" icon={ExternalLink}>
                                <p>En la parte superior se muestran dos tarjetas actualizadas en tiempo real:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Ventas del Día:</strong> Cantidad de transacciones según los filtros activos.</li>
                                    <li><strong>Monto Total:</strong> Suma monetaria de todas las ventas visibles.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                    {/* LEADS HELP */}
                    {activeModule === 'leads' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <UserPlus size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Leads / Contactos</h2>
                                    <p className="text-sm text-gray-500 font-medium">Gestión de base de datos y prospectos</p>
                                </div>
                            </header>

                            <HelpSection title="Pipeline de Ventas" icon={Info} defaultOpen={true}>
                                <p>Gestione el camino de sus prospectos desde que llegan al spa hasta que se convierten en citas confirmadas. El tablero Kanban organiza los leads en 4 columnas de estado:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                                    <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 text-center">Nuevo</span>
                                    <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 text-center">Contactado</span>
                                    <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-200 text-center">Vendido</span>
                                    <span className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 text-center">Descartado</span>
                                </div>
                                <p className="mt-4 font-bold text-indigo-900">¿De dónde vienen los leads?</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">WhatsApp</span>
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">Formulario Web</span>
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">Referidos</span>
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">Directo (Walk-in)</span>
                                </div>
                            </HelpSection>

                            <HelpSection title="Acciones en la Tarjeta del Lead" icon={ExternalLink}>
                                <p>Cada tarjeta de Lead muestra nombre, fuente, teléfono y monto asociado. Desde ella puede:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Avanzar de Estado:</strong> Use las flechas para mover el lead a la siguiente etapa del pipeline (Nuevo → Contactado → Vendido).</li>
                                    <li><strong>Retroceder:</strong> La flecha izquierda permite regresar un paso si hubo un error.</li>
                                    <li><strong>Contactar por WhatsApp:</strong> Click en el ícono del teléfono abre directamente una conversación de WhatsApp con el número del lead.</li>
                                    <li><strong>Eliminar:</strong> Disponible desde el menú contextual, requiere confirmación explícita.</li>
                                    <li><strong>Editar / Ver Detalle:</strong> Abre el panel modal completo del Lead.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Historial y Seguimiento Activo" icon={ExternalLink}>
                                <p>La ventana modal mejorada del Lead integra todos sus registros clave para operar sin cambiar de pantalla a lo largo de 4 pestañas vitales:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Detalles:</strong> Muestra la información de contacto primaria e indicadores de sucursal. Aquí se editan nombre, teléfono, email, fuente y sucursal del Lead.</li>
                                    <li><strong>Ventas:</strong> Permite consultar el balance de compras efectuadas y gestionar una <span className="text-emerald-600 font-bold">Nueva Venta</span> asociada al prospecto de forma directa, prellenando su nombre y sucursal.</li>
                                    <li><strong>Citas:</strong> Incluye cronología de atenciones y la facilidad integral de pre-llenar una nueva cita con datos del consumidor.</li>
                                    <li><strong>Tickets:</strong> Casos de soporte o seguimiento en curso vinculados al Lead. Incluye detalle del ticket, cambio de estado, comentarios y creación de nuevos tickets desde el mismo modal.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                    {/* AUDIT HELP */}
                    {activeModule === 'audit' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-slate-50 text-slate-600 rounded-2xl">
                                    <Activity size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Auditoría / Logs</h2>
                                    <p className="text-sm text-gray-500 font-medium">Registro de actividades y cambios del sistema</p>
                                </div>
                            </header>

                            <HelpSection title="Monitoreo y Rastreabilidad" icon={Info} defaultOpen={true}>
                                <p>El modelo de Logs guarda registro sobre cualquier acción clave (Creaciones, Ediciones, Cambios de Estado, Borrado de Datos, Ingresos al Sistema).</p>
                                <p className="mt-2 text-sm">La tabla principal muestra para cada evento:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-2 text-sm text-gray-700">
                                    <li><strong>Fecha/Hora:</strong> Momento exacto del evento.</li>
                                    <li><strong>Usuario:</strong> Quién realizó la acción (con avatar de iniciales).</li>
                                    <li><strong>Sucursal:</strong> Dónde ocurrió la operación.</li>
                                    <li><strong>Evento:</strong> Etiqueta con código de color — CREACIÓN (verde), MODIFICACIÓN (ámbar), ELIMINACIÓN (rojo), INGRESO (índigo), SALIDA (gris). Para ventas usa etiquetas especiales: NUEVA VENTA, VENTA MODIFICADA, VENTA ELIMINADA.</li>
                                    <li><strong>Objeto afectado:</strong> Nombre del modelo y su ID.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Filtros de Búsqueda" icon={ExternalLink}>
                                <p>La barra de filtros permite 5 criterios combinables para localizar eventos específicos:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-2 text-sm text-gray-700">
                                    <li><strong>Usuario:</strong> Seleccione para ver las acciones de un miembro particular del equipo.</li>
                                    <li><strong>Sucursal:</strong> Aísle los eventos de una locación específica.</li>
                                    <li><strong>Evento:</strong> Filtre por tipo: Creación, Modificación, Eliminación o Ingreso.</li>
                                    <li><strong>Búsqueda General:</strong> Texto libre para buscar por nombre, descripción o ID del elemento.</li>
                                    <li><strong>Limpiar:</strong> Botón para resetear todos los filtros de golpe.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Detalle de Actividad" icon={ExternalLink}>
                                <p>Al hacer clic en el ícono del ojo de una fila, se abre un modal con la vista completa del evento:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-2 text-sm text-gray-700">
                                    <li><strong>Valores Anteriores:</strong> Muestra el estado previo de los datos antes del cambio (en vista de código con fondo oscuro, texto rojo).</li>
                                    <li><strong>Valores Nuevos:</strong> El estado posterior al cambio (en texto verde). Para creaciones, el panel anterior muestra "Sin historial".</li>
                                    <li><strong>Metadatos:</strong> IP de origen, User Agent del navegador y sucursal desde donde se realizó la acción.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Exportación y Limpieza (Purga)" icon={ExternalLink}>
                                <p>El control continuo genera miles de registros. El sistema ofrece herramientas integradas para gestionarlos:</p>
                                <ul className="list-disc pl-5 mt-2 space-y-2 text-sm text-gray-700">
                                    <li><strong>Exportar:</strong> Seleccione el rango de antigüedad (7, 30, 90 días o 1 año) y descargue los logs en formato TXT.</li>
                                    <li><strong>Limpiar BD:</strong> Active la casilla "Limpiar BD" junto al botón de exportar para que, tras la descarga, los registros exportados se <strong className="text-red-500">eliminen de la base de datos</strong>. Se solicita confirmación explícita antes de ejecutar.</li>
                                    <li>La tabla incluye <strong>paginación</strong> para navegar entre páginas de resultados cuando el volumen es alto.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                    {/* LIVE CHAT HELP */}
                    {activeModule === 'communication' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl">
                                    <Radio size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Live Chat</h2>
                                    <p className="text-sm text-gray-500 font-medium">Mensajería centralizada vía WhatsApp / Chatwoot</p>
                                </div>
                            </header>

                            <HelpSection title="Visión General" icon={Info} defaultOpen={true}>
                                <p>El Live Chat centraliza toda la comunicación entre clientes/leads y su equipo. Los mensajes fluyen a través de la siguiente arquitectura:</p>
                                <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 mt-4">
                                    <p className="text-sm text-teal-900 font-medium">Cliente (WhatsApp) → Meta Cloud API → Chatwoot → Webhook → SPA Manager Pro</p>
                                    <p className="text-sm text-teal-900 font-medium mt-1">SPA Manager Pro → Chatwoot API → Meta → Cliente (WhatsApp)</p>
                                </div>
                                <p className="mt-3 text-sm">Los mensajes se reciben automáticamente y se vinculan con el Lead correspondiente por número telefónico.</p>
                            </HelpSection>

                            <HelpSection title="Panel de Conversaciones" icon={MessageSquare}>
                                <p>La interfaz se divide en 3 paneles:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Panel Izquierdo:</strong> Lista de conversaciones con filtros por estado (Abierto, Pendiente, Resuelto), control de Bot, indicador de no leídos y búsqueda por nombre o teléfono.</li>
                                    <li><strong>Panel Central:</strong> Chat en tiempo real con burbujas de mensaje, indicadores de estado (enviado, entregado, fallido) y campo de respuesta.</li>
                                    <li><strong>Panel Derecho:</strong> Detalle del contacto asociado, enlace al Lead y datos como teléfono, email, sucursal y usuario asignado.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Permisos de Conversación" icon={Shield}>
                                <p>El acceso a las conversaciones está controlado por permisos granulares:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-teal-600">view_conversations</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Ver conversaciones propias y las no asignadas.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-indigo-600">view_all_conversations</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Ver todas las conversaciones de todos los usuarios.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-emerald-600">reply_conversations</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Responder en conversaciones propias o sin asignar.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-amber-600">reply_all_conversations</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Responder en cualquier conversación del sistema.</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-gray-500">Los roles <strong>Admin</strong> y <strong>SuperAdmin</strong> tienen acceso total a todas las conversaciones.</p>
                            </HelpSection>

                            <HelpSection title="Control del Bot" icon={ExternalLink}>
                                <p>Cada conversación tiene un interruptor de Bot que determina si las respuestas automáticas (vía n8n) están activas:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Bot Activo:</strong> Las respuestas del flujo automatizado de n8n se procesan normalmente.</li>
                                    <li><strong>Bot Inactivo:</strong> Solo los usuarios humanos atienden la conversación. El bot se desactiva automáticamente cuando un usuario envía un mensaje manual.</li>
                                    <li>El botón de toggle permite reactivar el bot en cualquier momento.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                    {/* SETTINGS HELP */}
                    {activeModule === 'settings' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl">
                                    <Settings size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Configuración e Integraciones</h2>
                                    <p className="text-sm text-gray-500 font-medium">Guía técnica para la gestión multi-tenant y flujos de Chatwoot/n8n</p>
                                </div>
                            </header>

                            <HelpSection title="Gestión Multi-Tenant" icon={Shield} defaultOpen={true}>
                                <p>El sistema está diseñado bajo una arquitectura multi-inquilino (Multi-Tenant). Cada empresa o sucursal principal funciona como un compartimento estanco:</p>
                                <ul className="list-disc pl-5 mt-4 text-sm space-y-2">
                                    <li><strong>Aislamiento Total:</strong> Los datos de un tenant (Leads, Ventas, Usuarios, Claves API) son invisibles para los demás.</li>
                                    <li><strong>Configuración Independiente:</strong> Cada tenant tiene sus propias credenciales de Chatwoot y su propio flujo de n8n.</li>
                                    <li><strong>Permisos de SuperAdmin:</strong> Solo los usuarios con rol SuperAdmin pueden ver y editar la pestaña de "Tenants" para crear nuevos entornos.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Esquema de Integración Bidireccional" icon={Radio}>
                                <p>La comunicación fluye a través de <strong>n8n</strong>, que actúa como el cerebro u orquestador entre el chat (Chatwoot) y la gestión (SPA Manager Pro):</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                    <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100">
                                        <h4 className="font-black text-indigo-900 text-xs mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                            1. Flujo de Entrada (Cliente → App)
                                        </h4>
                                        <p className="text-xs text-indigo-800 leading-relaxed">
                                            Cliente escribe en <strong>WhatsApp</strong> → <strong>Chatwoot</strong> recibe el mensaje → Envía Webhook a <strong>n8n</strong> → n8n procesa (IA/Lógica) → n8n envía mensaje a <strong>App</strong> usando el <code className="bg-indigo-200 px-1 rounded">Tenant API Token</code>.
                                        </p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                                        <h4 className="font-black text-emerald-900 text-xs mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                            2. Flujo de Salida (App → Cliente)
                                        </h4>
                                        <p className="text-xs text-emerald-800 leading-relaxed">
                                            Usuario responde en <strong>App</strong> → App envía mensaje al Webhook de <strong>n8n</strong> usando el <code className="bg-emerald-200 px-1 rounded">N8N API Key</code> para seguridad → n8n envía respuesta a <strong>Chatwoot</strong> → Chatwoot entrega a <strong>WhatsApp</strong>.
                                        </p>
                                    </div>
                                </div>
                            </HelpSection>

                            <HelpSection title="Configuración de Integración (Campo por Campo)" icon={Key}>
                                <p className="mb-4">Para configurar un nuevo Tenant, acceda a la edición en la sección "Integraciones y API":</p>
                                
                                <div className="space-y-4">
                                    {/* SECCIÓN N8N */}
                                    <div className="border border-gray-100 rounded-2xl p-4">
                                        <h4 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-widest">Integración con n8n</h4>
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="font-mono text-[10px] bg-slate-100 px-2 py-1 rounded h-min shrink-0">Tenant API Token</div>
                                                <p className="text-xs text-gray-600"><strong>Sentido: n8n → App.</strong> Es la clave que n8n debe enviar en el header <code className="bg-gray-100 px-1 rounded">X-API-KEY</code> cuando llama a nuestra API. Es visible para el administrador pero se oculta tras guardarse.</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="font-mono text-[10px] bg-slate-100 px-2 py-1 rounded h-min shrink-0">N8N API Key</div>
                                                <p className="text-xs text-gray-600"><strong>Sentido: App → n8n.</strong> Si tu webhook en n8n tiene seguridad activada (Header Auth), pon aquí la clave. La App la enviará en el header <code className="bg-gray-100 px-1 rounded">X-API-KEY</code> al responder. Se guarda encriptada.</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="font-mono text-[10px] bg-slate-100 px-2 py-1 rounded h-min shrink-0">N8N Webhook URL</div>
                                                <p className="text-xs text-gray-600"><strong>Sentido: Salida.</strong> La URL del nodo Webhook en n8n que recibirá las respuestas manuales de tus vendedores.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECCIÓN CHATWOOT */}
                                    <div className="border border-gray-100 rounded-2xl p-4">
                                        <h4 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-widest">Conexión con Chatwoot (WhatsApp)</h4>
                                        <div className="space-y-3">
                                            <div className="flex gap-3">
                                                <div className="font-mono text-[10px] bg-teal-50 text-teal-700 px-2 py-1 rounded h-min shrink-0">Base URL</div>
                                                <p className="text-xs text-gray-600">URL base de tu instancia (ej: <em>https://app.chatwoot.com</em>). No incluir "/" al final.</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="font-mono text-[10px] bg-teal-50 text-teal-700 px-2 py-1 rounded h-min shrink-0">Account / Inbox ID</div>
                                                <p className="text-xs text-gray-600">IDs numéricos que identifican tu cuenta y la bandeja de WhatsApp específica dentro de Chatwoot.</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="font-mono text-[10px] bg-teal-50 text-teal-700 px-2 py-1 rounded h-min shrink-0">API Token</div>
                                                <p className="text-xs text-gray-600">Token de acceso (Perfil → Configuración → Token). Permite a la App enviar mensajes de vuelta.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </HelpSection>

                            <HelpSection title="Guía de Implementación para Nuevo Tenant" icon={BookOpen}>
                                <p className="mb-4">Para poner en marcha un nuevo inquilino desde cero, siga este orden:</p>
                                <ol className="list-decimal pl-5 space-y-4 text-xs font-medium text-gray-700">
                                    <li>
                                        <strong>Crear el Tenant:</strong> Registre el nombre en la App y genere un <code className="bg-gray-100 px-1 rounded">Tenant API Token</code> aleatorio.
                                    </li>
                                    <li>
                                        <strong>Configurar n8n:</strong> Cree un nuevo flujo en n8n para este inquilino. 
                                        <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-500 font-normal">
                                            <li>Nodo de entrada (Webhook): Pon su URL en la App como "N8N Webhook URL".</li>
                                            <li>Nodo de salida (HTTP Request): Configúralo para llamar a <code className="bg-indigo-50 px-1 rounded text-indigo-600">POST /api/communications/webhooks/chatwoot</code> incluyendo el API Token del paso 1.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Vincular Chatwoot:</strong> En Configuración → Integraciones de Chatwoot, agrega un Webhook que apunte **directamente a n8n** (no a la App), para que n8n pueda procesar el mensaje antes de enviarlo a nuestra plataforma.
                                    </li>
                                    <li>
                                        <strong>Activar el flujo:</strong> Una vez guardado todo, los mensajes de WhatsApp aparecerán automáticamente en el "Live Chat" de la App para ese Tenant.
                                    </li>
                                </ol>
                            </HelpSection>

                            <HelpSection title="Seguridad y Protección contra Sobreescritura" icon={Shield}>
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-4">
                                    <Info className="text-amber-600 shrink-0" size={20} />
                                    <div className="text-xs text-amber-900 leading-relaxed">
                                        <p className="font-bold mb-1 underline">Protección de Credenciales:</p>
                                        <p>Las claves sensibles se ocultan tras el símbolo <code className="bg-amber-200">••••••••</code> una vez guardadas. Para proteger la operatividad:</p>
                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                            <li>Si intenta borrar o cambiar un campo ya configurado, el sistema solicitará una <strong>confirmación obligatoria</strong>.</li>
                                            <li>Para actualizar una clave, puede usar el botón de **"Reset"** (icono de flecha circular) para limpiar el campo y escribir el valor nuevo.</li>
                                            <li>El servidor ignora automáticamente los valores "<code className="font-mono">••••••••</code>" durante una actualización, por lo que puede editar el nombre del Tenant sin riesgo de borrar las llaves guardadas por accidente.</li>
                                        </ul>
                                    </div>
                                </div>
                            </HelpSection>

                            <HelpSection title="Rate Limiting (Protección)" icon={Shield}>
                                <p>Para proteger el servidor de abusos, los endpoints públicos tienen límites de peticiones:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-red-600">Login</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Máximo 5 intentos por minuto por IP.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-amber-600">Lead Webhook</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Máximo 10 peticiones por minuto.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-teal-600">Bot Appointments</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Máximo 60 peticiones por minuto.</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                        <span className="text-[10px] font-black uppercase text-indigo-600">Chatwoot Webhook</span>
                                        <p className="text-xs text-gray-800 mt-1 font-medium">Máximo 120 peticiones por minuto.</p>
                                    </div>
                                </div>
                            </HelpSection>

                            <HelpSection title="Sucursales (Branches)" icon={ExternalLink}>
                                <p>Aquí usted establece las ubicaciones operativas del negocio:</p>
                                <ul className="list-disc pl-5 mt-4 text-sm space-y-2">
                                    <li>Cada sucursal creada se vincula automáticamente al tenant actual.</li>
                                    <li>Las sucursales aparecen como opciones en Ventas, Citas, Inventario, Leads y Auditoría.</li>
                                    <li>Puede editar nombre o desactivar sucursales sin perder los registros asociados.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Roles, Permisos y Usuarios" icon={ExternalLink}>
                                <p>El sistema de control de acceso funciona en dos niveles:</p>
                                <ul className="list-disc pl-5 mt-4 text-sm space-y-2">
                                    <li><strong>Roles:</strong> Agrupe permisos bajo un nombre lógico (Vendedor, Cajero, Administrador, etc.).</li>
                                    <li><strong>Permisos:</strong> Controles granulares como <em>view_leads</em>, <em>delete_product</em>, <em>view_branch</em>, <em>view_conversations</em>, <em>reply_all_conversations</em>, etc. que determinan qué secciones y acciones son accesibles.</li>
                                    <li><strong>Usuarios:</strong> Cada miembro del equipo se asocia a un rol, una sucursal y un tenant.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                    {/* NOTIFICATIONS HELP */}
                    {activeModule === 'notifications' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <header className="flex items-center gap-4 mb-8">
                                <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl">
                                    <Bell size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Notificaciones</h2>
                                    <p className="text-sm text-gray-500 font-medium">Sistema de alertas y avisos en tiempo real</p>
                                </div>
                            </header>

                            <HelpSection title="Campana de Notificaciones" icon={Info} defaultOpen={true}>
                                <p>En la barra superior de la aplicación encontrará un ícono de campana que muestra las notificaciones pendientes:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Indicador de Conteo:</strong> Un badge rojo muestra cuántas notificaciones no leídas tiene.</li>
                                    <li><strong>Panel Desplegable:</strong> Al hacer clic en la campana, se abre un panel con la lista de notificaciones ordenadas de más reciente a más antigua.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Gestión de Notificaciones" icon={ExternalLink}>
                                <p>Acciones disponibles en el panel de notificaciones:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Marcar como Leída:</strong> Haga clic en una notificación no leída para marcarla individualmente. Las no leídas se distinguen con fondo resaltado.</li>
                                    <li><strong>Marcar Todas:</strong> Use el botón "Marcar todas como leídas" en la parte superior del panel para limpiar el contador de golpe.</li>
                                    <li><strong>Navegación Directa:</strong> Algunas notificaciones incluyen enlaces a la acción relacionada (ej: abrir un ticket, ver una venta), facilitando la navegación sin buscar manualmente el registro.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Tipos de Notificaciones" icon={ExternalLink}>
                                <p>El sistema genera notificaciones automáticas para eventos clave como:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li>Asignación de nuevos tickets.</li>
                                    <li>Alertas de vencimiento de SLA.</li>
                                    <li>Cambios de estado en ventas o citas.</li>
                                    <li>Alertas de stock bajo en productos.</li>
                                    <li>Alertas de purga de logs pendiente.</li>
                                </ul>
                            </HelpSection>
                        </div>
                    )}

                </div>

                <footer className="mt-8 text-center text-gray-400 text-xs font-medium flex items-center justify-center gap-2">
                    <span>© 2026 SPA Manager PRO</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span>Guía de Sistema v2.0</span>
                </footer>
            </main>
        </div>
    );
};

export default Help;
