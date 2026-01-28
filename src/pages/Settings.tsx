import React, { useMemo, useState } from "react";
import BranchesSettings from "../settings/BranchesSettings";
import UsersSettings from "../settings/UsersSettings";
import RolesPermissionsSettings from "../settings/RolesPermissionsSettings";

type TabKey = "branches" | "users" | "rbac";

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${
      active
        ? "bg-indigo-600 text-white border-indigo-600"
        : "bg-white text-gray-700 hover:bg-gray-50"
    }`}
  >
    {children}
  </button>
);

const SettingsPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>("branches");

  const title = useMemo(() => {
    if (tab === "branches") return "Sucursales";
    if (tab === "users") return "Usuarios";
    return "Roles y permisos";
  }, [tab]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>
          <p className="text-sm text-gray-500">
            Administra sucursales, usuarios y permisos del sistema.
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <TabButton active={tab === "branches"} onClick={() => setTab("branches")}>
          Sucursales
        </TabButton>
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>
          Usuarios
        </TabButton>
        <TabButton active={tab === "rbac"} onClick={() => setTab("rbac")}>
          Roles y permisos
        </TabButton>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>

        {tab === "branches" && <BranchesSettings />}
        {tab === "users" && <UsersSettings />}
        {tab === "rbac" && <RolesPermissionsSettings />}
      </div>
    </div>
  );
};

export default SettingsPage;
