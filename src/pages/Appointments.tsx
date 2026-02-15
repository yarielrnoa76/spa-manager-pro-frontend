import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { Appointment, Branch } from "../types";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";

type CreateAppointmentPayload = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  client_name: string;
  service_type: string;
  branch_id?: number | null;
  notes?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Genera una grilla tipo calendario:
 * - 6 semanas (42 celdas)
 * - comienza el domingo (0)
 */
function buildCalendarGrid(viewDate: Date) {
  const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);

  const firstDow = first.getDay(); // 0=Sun
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstDow); // retrocede al domingo

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d >= first && d <= last });
  }
  return cells;
}

async function createAppointment(payload: CreateAppointmentPayload) {
  // intenta método específico si existe
  const anyApi: any = api as any;
  if (typeof anyApi.createAppointment === "function") {
    return anyApi.createAppointment(payload);
  }

  // fallback: si api es un axios instance con .post
  if (typeof anyApi.post === "function") {
    const res = await anyApi.post("/appointments", payload);
    return res?.data ?? res;
  }

  throw new Error(
    "No encontré api.createAppointment() ni api.post(). Ajusta createAppointment() a tu servicio.",
  );
}

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mes visible en el calendario
  const [viewDate, setViewDate] = useState<Date>(() =>
    startOfMonth(new Date()),
  );

  // Día seleccionado (para sidebar + resaltar)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Modal create
  const [openCreate, setOpenCreate] = useState(false);

  // Modal agenda
  const [openAgenda, setOpenAgenda] = useState(false);

  const [form, setForm] = useState<CreateAppointmentPayload>(() => {
    const now = new Date();
    return {
      date: toYMD(now),
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      client_name: "",
      service_type: "",
      branch_id: null,
      notes: "",
    };
  });

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [a, b] = await Promise.all([
        api.listAppointments(),
        api.listBranches(),
      ]);
      setAppointments(a);
      setBranches(b);
    } catch (e: any) {
      setError(e?.message ?? "Error loading appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el user navega a otro mes, seleccionamos el 1 de ese mes (opcional pero consistente)
  const goPrevMonth = () => {
    const next = addMonths(viewDate, -1);
    setViewDate(next);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const goNextMonth = () => {
    const next = addMonths(viewDate, 1);
    setViewDate(next);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const monthTitle = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(viewDate);
  }, [viewDate]);

  const grid = useMemo(() => buildCalendarGrid(viewDate), [viewDate]);

  // index rápido por YYYY-MM-DD
  const appsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const d = new Date(a.date);
      const key = toYMD(d);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    // opcional: ordenar por hora si viene como "HH:mm"
    for (const [k, arr] of map.entries()) {
      arr.sort((x, y) =>
        String(x.time ?? "").localeCompare(String(y.time ?? "")),
      );
      map.set(k, arr);
    }
    return map;
  }, [appointments]);

  const selectedKey = useMemo(() => toYMD(selectedDate), [selectedDate]);

  const selectedDayAppointments = useMemo(() => {
    return appsByDay.get(selectedKey) ?? [];
  }, [appsByDay, selectedKey]);

  // Agenda: ejemplo = todos los appointments del mes visible
  const monthAgenda = useMemo(() => {
    const first = startOfMonth(viewDate);
    const last = endOfMonth(viewDate);
    const rows: Appointment[] = [];
    for (const a of appointments) {
      const d = new Date(a.date);
      if (d >= first && d <= last) rows.push(a);
    }
    rows.sort((x, y) => {
      const dx = new Date(x.date).getTime();
      const dy = new Date(y.date).getTime();
      if (dx !== dy) return dx - dy;
      return String(x.time ?? "").localeCompare(String(y.time ?? ""));
    });
    return rows;
  }, [appointments, viewDate]);

  const openCreateForDay = (d: Date) => {
    setForm((prev) => ({
      ...prev,
      date: toYMD(d),
      time: prev.time || "09:00",
      client_name: "",
      service_type: "",
      branch_id: prev.branch_id ?? null,
      notes: "",
    }));
    setOpenCreate(true);
  };

  const handleCreate = async () => {
    // validación mínima
    if (!form.client_name.trim()) return setError("Client name is required.");
    if (!form.service_type.trim()) return setError("Service type is required.");
    if (!form.date) return setError("Date is required.");
    if (!form.time) return setError("Time is required.");

    try {
      setError(null);
      await createAppointment({
        ...form,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
      });
      setOpenCreate(false);
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? "Error creating appointment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Appointment Schedule</h1>
          <p className="text-gray-500 text-sm">
            Manage client sessions and treatment calendar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <button
              type="button"
              onClick={goPrevMonth}
              className="p-2 hover:bg-gray-50 transition"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-4 text-sm font-bold border-x border-gray-200 py-2">
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              className="p-2 hover:bg-gray-50 transition"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => openCreateForDay(selectedDate)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-md"
          >
            <Plus size={18} />
            New Appointment
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Calendar */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {days.map((day) => (
              <div
                key={day}
                className="py-3 text-center text-xs font-bold text-gray-400 uppercase"
              >
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="p-6 text-sm text-gray-500">Loading...</div>
          ) : (
            <div className="grid grid-cols-7">
              {grid.map((cell, i) => {
                const key = toYMD(cell.date);
                const dayApps = appsByDay.get(key) ?? [];
                const isToday = sameDay(cell.date, new Date());
                const isSelected = sameDay(cell.date, selectedDate);

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDate(cell.date)}
                    className={[
                      "min-h-[120px] border-r border-b border-gray-100 p-2 transition cursor-pointer group",
                      cell.inMonth
                        ? "bg-white hover:bg-indigo-50"
                        : "bg-gray-50 hover:bg-indigo-50",
                      isSelected ? "ring-2 ring-indigo-500 ring-inset" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={[
                          "text-sm font-semibold",
                          isToday
                            ? "bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full"
                            : "",
                          !isToday && cell.inMonth ? "text-gray-700" : "",
                          !isToday && !cell.inMonth ? "text-gray-400" : "",
                        ].join(" ")}
                      >
                        {cell.date.getDate()}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateForDay(cell.date);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-white"
                        title="Create appointment"
                      >
                        <Plus size={14} className="text-indigo-600" />
                      </button>
                    </div>

                    {dayApps.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {dayApps.slice(0, 3).map((a) => (
                          <div
                            key={a.id}
                            className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] rounded-md font-bold truncate"
                            title={`${a.time} - ${a.client_name}`}
                          >
                            {a.time} - {a.client_name}
                          </div>
                        ))}
                        {dayApps.length > 3 && (
                          <div className="text-[10px] text-gray-500 font-semibold">
                            +{dayApps.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CalendarIcon size={18} className="text-indigo-600" />
              Schedule for{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              }).format(selectedDate)}
            </h3>

            <div className="space-y-4">
              {selectedDayAppointments.map((app) => (
                <div
                  key={app.id}
                  className="border-l-4 border-indigo-600 pl-4 py-1"
                >
                  <p className="text-sm font-bold">{app.client_name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Clock size={12} />
                    {app.time} • {app.service_type}
                  </div>
                </div>
              ))}
              {selectedDayAppointments.length === 0 && (
                <p className="text-sm text-gray-400">
                  No sessions on this day.
                </p>
              )}
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-xl text-white shadow-lg">
            <h3 className="font-bold text-lg mb-2">Monthly Summary</h3>
            <p className="text-indigo-100 text-sm mb-4">
              You have <span className="font-bold">{monthAgenda.length}</span>{" "}
              appointments in {monthTitle}.
            </p>
            <button
              type="button"
              onClick={() => setOpenAgenda(true)}
              className="w-full py-2 bg-white text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition"
            >
              View Agenda
            </button>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {openCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold">New Appointment</h3>
              <button
                type="button"
                onClick={() => setOpenCreate(false)}
                className="p-2 rounded hover:bg-gray-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, date: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, time: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Client name
                </label>
                <input
                  value={form.client_name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, client_name: e.target.value }))
                  }
                  placeholder="John Doe"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Service type
                </label>
                <input
                  value={form.service_type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, service_type: e.target.value }))
                  }
                  placeholder="Facial, Massage, Botox..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Branch
                </label>
                <select
                  value={form.branch_id ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      branch_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">(No branch)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[90px]"
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenCreate(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AGENDA MODAL */}
      {openAgenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold">Agenda • {monthTitle}</h3>
              <button
                type="button"
                onClick={() => setOpenAgenda(false)}
                className="p-2 rounded hover:bg-gray-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 max-h-[65vh] overflow-auto">
              {monthAgenda.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No appointments in this month.
                </p>
              ) : (
                <div className="space-y-3">
                  {monthAgenda.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm">{a.client_name}</div>
                        <div className="text-xs text-gray-500">
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                          }).format(new Date(a.date))}{" "}
                          • {a.time}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {a.service_type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setOpenAgenda(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
