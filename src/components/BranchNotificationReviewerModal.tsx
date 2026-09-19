import React, { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import { api } from "../services/api";
import type { BranchNotificationReviewer } from "../types";
import {
  REVIEWER_EXPLANATION,
  REVIEWER_OWNERSHIP_NOTE,
  readReviewerResponse,
  reviewerDisplay,
  reviewerLabel,
  reviewerReasonMessage,
} from "../utils/branchNotificationReviewer";

type LoadState = "loading" | "ready" | "forbidden" | "not_found" | "error";

type ErrorLike = {
  status?: number;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
  data?: { reason?: string };
};

/** The reason for a save that failed with a plain 422 validation payload, first message only. */
function firstValidationMessage(err: ErrorLike): string | null {
  const errors = err.errors;
  if (!errors) return null;
  const firstKey = Object.keys(errors)[0];
  return firstKey ? (errors[firstKey]?.[0] ?? null) : null;
}

type Props = {
  branchId: number;
  branchName: string;
  /** Effective tenant of the screen. Only used to reset every piece of state when it changes;
   * the tenant itself is always resolved by the backend, never sent by this component. */
  tenantId?: number | null;
  onClose: () => void;
};

const Panel: React.FC<Props> = ({ branchId, branchName, onClose }) => {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  // The last configuration CONFIRMED by the backend. It is only ever replaced by a successful
  // response -- never by an optimistic guess -- so the screen cannot show a rejected setting.
  const [config, setConfig] = useState<BranchNotificationReviewer | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getBranchNotificationReviewer(branchId)
      .then((res) => {
        if (cancelled) return;
        const next = readReviewerResponse(res, branchId);
        if (!next) {
          setLoadError("The server returned an unexpected response for this branch.");
          setLoadState("error");
          return;
        }
        setConfig(next);
        setSelectedId(next.user_id !== null ? String(next.user_id) : "");
        setLoadState("ready");
      })
      .catch((err: ErrorLike) => {
        if (cancelled) return;
        if (err?.status === 403) setLoadState("forbidden");
        else if (err?.status === 404) setLoadState("not_found");
        else {
          setLoadError(err?.message || "Could not load the reviewer settings.");
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, reloadKey]);

  const retry = () => {
    setLoadError(null);
    setLoadState("loading");
    setReloadKey((k) => k + 1);
  };

  /** Re-reads the configuration after a rejected save so the candidate list and permissions
   * reflect what the backend now says. A failure here is ignored: the rejection stays visible. */
  const refreshAfterRejection = useCallback(async () => {
    try {
      const res = await api.getBranchNotificationReviewer(branchId);
      if (!mounted.current) return;
      const next = readReviewerResponse(res, branchId);
      if (!next) return;
      setConfig(next);
      setSelectedId(next.user_id !== null ? String(next.user_id) : "");
    } catch {
      /* keep the rejection message; the next explicit load will report a persistent failure */
    }
  }, [branchId]);

  const canManage = config?.capabilities.can_manage === true;
  const candidates = config?.candidates ?? [];
  const currentId = config?.user_id ?? null;
  const unchanged = selectedId === "" || (currentId !== null && selectedId === String(currentId));
  const currentIsSelectable = currentId !== null && candidates.some((c) => c.id === currentId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !canManage || saving || unchanged) return;

    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const res = await api.setBranchNotificationReviewer(branchId, Number(selectedId));
      if (!mounted.current) return;
      const next = readReviewerResponse(res, branchId);
      if (!next) {
        setSaveError(
          "The server response could not be confirmed. Close this window and reopen it to see the current reviewer.",
        );
        return;
      }
      setConfig(next);
      setSelectedId(next.user_id !== null ? String(next.user_id) : "");
      setNotice(
        res.meta?.outcome === "unchanged"
          ? "This user is already the default notification reviewer. Nothing changed."
          : "Default notification reviewer updated.",
      );
    } catch (raw) {
      if (!mounted.current) return;
      const err = (raw ?? {}) as ErrorLike;
      if (err.status === 403) {
        setSaveError("You do not have permission to change the notification reviewer for this branch.");
        void refreshAfterRejection();
      } else if (err.status === 404) {
        setSaveError("This branch is no longer available.");
        setLoadState("not_found");
      } else if (err.status === 422 && err.code === "REVIEWER_NOT_ELIGIBLE") {
        setSaveError(reviewerReasonMessage(err.data?.reason));
        void refreshAfterRejection();
      } else if (err.status === 422) {
        setSaveError(firstValidationMessage(err) ?? err.message ?? "Validation failed.");
      } else {
        setSaveError(err.message || "Could not save the default notification reviewer.");
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const renderCurrent = (cfg: BranchNotificationReviewer) => {
    if (cfg.status === "not_configured") {
      return (
        <>
          <p className="text-sm font-semibold text-gray-700" data-testid="reviewer-current">
            No default reviewer
          </p>
          <p className="text-xs text-amber-700 mt-1" data-testid="reviewer-not-configured-warning">
            No one is alerted about unassigned leads and tickets in this branch until a reviewer is
            selected.
          </p>
        </>
      );
    }

    // A null user with a status other than "not_configured" means several enabled recipients.
    const label = cfg.user === null ? "Multiple reviewers enabled" : reviewerDisplay(cfg.user);

    return (
      <>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800" data-testid="reviewer-current">
            {label}
          </p>
          {cfg.status === "valid" ? (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-green-50 text-green-700">
              Eligible
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700">
              Needs attention
            </span>
          )}
        </div>
        {cfg.status === "invalid" && (
          <p className="text-xs text-amber-700 mt-1" data-testid="reviewer-invalid-reason">
            {reviewerReasonMessage(cfg.invalid_reason)}
          </p>
        )}
      </>
    );
  };

  const renderBody = () => {
    if (loadState === "loading") {
      return (
        <p className="text-sm text-gray-500" data-testid="reviewer-loading">
          Loading reviewer settings…
        </p>
      );
    }
    if (loadState === "forbidden") {
      return (
        <p className="text-sm text-gray-600" data-testid="reviewer-forbidden">
          You do not have permission to view the notification reviewer for this branch.
        </p>
      );
    }
    if (loadState === "not_found") {
      return (
        <p className="text-sm text-gray-600" data-testid="reviewer-not-found">
          This branch is not available.
        </p>
      );
    }
    if (loadState === "error" || !config) {
      return (
        <div className="space-y-3" data-testid="reviewer-load-error">
          <p className="text-sm text-red-600">
            {loadError ?? "Could not load the reviewer settings."}
          </p>
          <button
            type="button"
            onClick={retry}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600" data-testid="reviewer-explanation">
          {REVIEWER_EXPLANATION}
        </p>

        <dl
          className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm"
          data-testid="reviewer-roles-legend"
        >
          <div className="flex gap-3 px-3 py-2 bg-indigo-50/60">
            <dt className="w-40 shrink-0 font-semibold text-indigo-700">Notification reviewer</dt>
            <dd className="text-gray-700">Receives the alerts. This is the setting on this screen.</dd>
          </div>
          <div className="flex gap-3 px-3 py-2">
            <dt className="w-40 shrink-0 font-semibold text-gray-700">Lead owner</dt>
            <dd className="text-gray-500">Set on each lead.</dd>
          </div>
          <div className="flex gap-3 px-3 py-2">
            <dt className="w-40 shrink-0 font-semibold text-gray-700">Ticket assignee</dt>
            <dd className="text-gray-500">Set on each ticket.</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500">{REVIEWER_OWNERSHIP_NOTE}</p>

        <div>
          <p className="block text-xs font-bold text-gray-500 uppercase mb-1">Current reviewer</p>
          {renderCurrent(config)}
        </div>

        {canManage ? (
          candidates.length === 0 ? (
            <p
              className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
              data-testid="reviewer-empty"
            >
              No eligible users found for this branch. A reviewer needs access to this branch and
              permission to view and assign both tickets and leads.
            </p>
          ) : (
            <div>
              <label
                htmlFor="branch-reviewer-select"
                className="block text-xs font-bold text-gray-500 uppercase mb-1"
              >
                Reviewer
              </label>
              <select
                id="branch-reviewer-select"
                data-testid="reviewer-select"
                value={selectedId}
                disabled={saving}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setSaveError(null);
                  setNotice(null);
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm disabled:bg-gray-50"
              >
                <option value="" disabled>
                  Select a branch user
                </option>
                {currentId !== null && !currentIsSelectable && (
                  <option value={String(currentId)} disabled data-testid="reviewer-orphaned-current">
                    {reviewerDisplay(config?.user ?? null)} (current, no longer eligible)
                  </option>
                )}
                {candidates.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {reviewerLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          )
        ) : (
          <p className="text-xs text-gray-500 italic" data-testid="reviewer-read-only">
            You can view this setting but you do not have permission to change it.
          </p>
        )}

        {notice && (
          <div
            role="status"
            data-testid="reviewer-notice"
            className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
          >
            {notice}
          </div>
        )}
        {saveError && (
          <div
            role="alert"
            data-testid="reviewer-save-error"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {saveError}
          </div>
        )}
      </div>
    );
  };

  const showSave = loadState === "ready" && canManage && candidates.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-reviewer-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/80">
          <div>
            <h2
              id="branch-reviewer-title"
              className="text-xl font-bold text-gray-800 flex items-center gap-2"
            >
              <BellRing size={22} className="text-indigo-600" />
              Default notification reviewer
            </h2>
            <p className="text-xs text-gray-500 mt-0.5" data-testid="reviewer-branch-name">
              {branchName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col min-h-0">
          <div className="px-6 py-5 overflow-y-auto">{renderBody()}</div>

          <div className="px-6 py-4 border-t bg-gray-50/80 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Close
            </button>
            {showSave && (
              <button
                type="submit"
                disabled={saving || unchanged}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition"
              >
                {saving ? "Saving…" : "Save reviewer"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Keyed by tenant and branch: switching either one discards every piece of state (the loaded
 * configuration, the candidate list, the pending selection and any message), so nothing loaded
 * for one branch can ever be shown or saved against another.
 */
const BranchNotificationReviewerModal: React.FC<Props> = (props) => (
  <Panel key={`${props.tenantId ?? "none"}:${props.branchId}`} {...props} />
);

export default BranchNotificationReviewerModal;
