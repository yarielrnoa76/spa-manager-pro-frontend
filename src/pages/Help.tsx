import React, { useState } from 'react';
import {
    HelpCircle, Ticket, Calendar, Package, DollarSign, UserPlus,
    ChevronDown, ChevronUp, BookOpen, Info, MessageSquare,
    Search, ExternalLink, ArrowRight, Settings, Activity
} from 'lucide-react';

type ModuleKey = 'tickets' | 'appointments' | 'inventory' | 'sales' | 'leads' | 'audit' | 'settings';

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
    const [activeModule, setActiveModule] = useState<ModuleKey>('tickets');

    const menuItems: { id: ModuleKey; label: string; icon: React.ElementType; color: string }[] = [
        { id: 'tickets', label: 'Tickets', icon: Ticket, color: 'text-blue-600 bg-blue-50' },
        { id: 'appointments', label: 'Citas', icon: Calendar, color: 'text-purple-600 bg-purple-50' },
        { id: 'inventory', label: 'Inventario', icon: Package, color: 'text-amber-600 bg-amber-50' },
        { id: 'sales', label: 'Ventas Diarias', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
        { id: 'leads', label: 'Contactos / Leads', icon: UserPlus, color: 'text-indigo-600 bg-indigo-50' },
        { id: 'audit', label: 'Auditoría / Logs', icon: Activity, color: 'text-slate-600 bg-slate-50' },
        { id: 'settings', label: 'Configuración', icon: Settings, color: 'text-rose-600 bg-rose-50' },
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
                                </div>
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
                                <p>Cada producto cuenta con una ficha técnica que incluye su precio de venta, categoría y cantidad en bodega (stock). Recuerde interactuar con la lista actualizando periódicamente los precios y utilizando el buscador por SKU/Código para encontrar más rápido sus elementos en caja.</p>
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-4 mt-4">
                                    <Info className="text-amber-600 shrink-0" size={20} />
                                    <p className="text-sm text-amber-900"><strong>Dato importante:</strong> El stock se descuenta automáticamente al finalizar una venta, ahorrando control dual para el almacén.</p>
                                </div>
                            </HelpSection>

                            <HelpSection title="Alertas de Stock" icon={ExternalLink}>
                                <p>El sistema resaltará en color rojo aquellos productos cuyas existencias sean bajas para que pueda programar su reabastecimiento a tiempo.</p>
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
                                </ul>
                            </HelpSection>

                            <HelpSection title="Reporte Diario" icon={ExternalLink}>
                                <p>Al final del día, puede visualizar el resumen totalizado para asegurar que los depósitos o efectivo coincidan con el sistema.</p>
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
                                <p>Gestione el camino de sus prospectos desde que llegan al spa hasta que se convierten en citas confirmadas.</p>
                                <p className="mt-2 font-bold text-indigo-900">¿De dónde vienen los leads?</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">WhatsApp</span>
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">Formulario Web</span>
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">Referidos</span>
                                    <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-medium border border-gray-200">Directo (Walk-in)</span>
                                </div>
                            </HelpSection>

                            <HelpSection title="Historial y Seguimiento Activo" icon={ExternalLink}>
                                <p>La ventana modal mejorada del Lead integra todos sus registros clave para operar sin cambiar de pantalla a lo largo de 4 pestañas vitales:</p>
                                <ul className="list-disc pl-5 space-y-2 mt-4 text-sm">
                                    <li><strong>Detalles:</strong> Muestra la información de contacto primaria e indicadores de sucursal.</li>
                                    <li><strong>Ventas:</strong> Permite consultar el balance de compras efectuadas y gestionar una <span className="text-emerald-600 font-bold">Nueva Venta</span> asociada al prospecto de forma directa.</li>
                                    <li><strong>Citas:</strong> Incluye cronología de atenciones y la facilidad integral de pre-llenar una nueva cita con datos del consumidor.</li>
                                    <li><strong>Tickets:</strong> Casos de soporte o seguimiento en curso vinculados al Lead por peticiones a nivel mesa de ayuda.</li>
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
                                <p>El modelo de Logs guarda registro sobre cualquier acción clave (Creaciones, Ediciones, Cambios de Estado, Borrado de Datos). </p>
                                <ul className="list-disc pl-5 mt-4 space-y-2 text-sm text-gray-700">
                                    <li><strong>Trazabilidad General:</strong> Cada proceso se firma con el responsable que hizo la operacion, un campo de tiempo fechado e incluso su identificador IP.</li>
                                    <li><strong>Búsqueda Flexible:</strong> Gracias a los filtros habilitados puede indagar sobre qué realizó un usuario específico ayer, o ver cómo cambió el estado de las Citas en una fecha puntual.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Limpieza de Logs (Purga)" icon={ExternalLink}>
                                <p>El control continuo genera miles de registros y por tanto el sistema cuenta con políticas de retención activas.</p>
                                <ul className="list-disc pl-5 mt-2 space-y-2 text-sm text-gray-700">
                                    <li>Al vencer las fechas de registro y cuando la tabla necesita limpieza, la página lo anunciará mediante <strong className="text-red-500">alertas en el panel de inicio</strong>.</li>
                                    <li>Para proteger la integridad y no borrar datos accidentalmente la <strong>Purga se aprueba en proceso de "Usuario en el Lazo"</strong> donde el personal de Administración con la autorización correcta aprueba el vaciado periódico y lo confirma explícitamente desde los botones en pantalla.</li>
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
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Configuración</h2>
                                    <p className="text-sm text-gray-500 font-medium">Ajustes generales y administración del sistema</p>
                                </div>
                            </header>

                            <HelpSection title="Ajustes Generales de Personal" icon={Info} defaultOpen={true}>
                                <p>Dentro del Gestor usted puede delimitar privilegios operativos asociando cada miembro entre roles y usuarios base sin poner en juego parámetros maestros u operativas ajenas:</p>
                                <ul className="list-disc pl-5 mt-4 text-sm space-y-1">
                                    <li><strong>Usuarios:</strong> Provea perfiles que podrán conectarse al software.</li>
                                    <li><strong>Permisos:</strong> Bloquee áreas y edite accesos por roles en base si son personal comercial (Vendedores), Cajas, Administrativos o Gestores TI.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Parámetros de Negocio" icon={ExternalLink}>
                                <p>Aquí usted establece los conceptos básicos por donde el Spa ofrecerá cobertura y valor:</p>
                                <ul className="list-disc pl-5 mt-4 text-sm space-y-2">
                                    <li><strong>Servicios/Tratamientos:</strong> Construya las opciones para las Citas y las Ventas Diarias dándoles tiempo y tarifa promedio.</li>
                                    <li><strong>Sucursales:</strong> Cree o apague ubicaciones (ej: Local Norte, Mall) donde su inventario y atención de Leads ocurren en paralelo.</li>
                                </ul>
                            </HelpSection>

                            <HelpSection title="Ajustes Globales y Retención (Políticas/SLA)" icon={ExternalLink}>
                                <p>Para las opciones centralizadas de soporte interno encontrará los apartados avanzados del software:</p>
                                <p className="mt-2 text-sm">Allí puede editar las <strong>Políticas de SLA</strong> que calculan los colores rojo de respuesta tarde sobre sus "Tickets", o la <strong>Retención y el Purificador de Auditoría</strong> para cambiar si se guarda memoria permanente o si avisa y permite limpieza de la vista operativa.</p>
                            </HelpSection>
                        </div>
                    )}

                </div>

                <footer className="mt-8 text-center text-gray-400 text-xs font-medium flex items-center justify-center gap-2">
                    <span>© 2026 SPA Manager PRO</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span>Guía de Sistema v1.0</span>
                </footer>
            </main>
        </div>
    );
};

export default Help;
