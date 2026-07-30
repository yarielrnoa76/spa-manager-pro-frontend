import { useEffect, useRef } from "react";

const TERMINAL_STATUSES = new Set([
    "paid",
    "failed",
    "expired",
    "cancelled",
    "refunded",
    "partially_refunded",
]);

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Refreshes payment status automatically while a Stripe Checkout link is outstanding:
 * - Polls `refetch` every ~5s while `status` is non-terminal.
 * - Refetches immediately when the tab/window regains focus or visibility, regardless of the
 *   poll interval.
 * - Stops polling once `status` reaches a terminal value, or after a 10-minute ceiling (in case
 *   staff leave the tab open indefinitely).
 *
 * The webhook remains the sole authoritative writer of payment state — this hook only re-fetches
 * already-computed backend state (via `refetch`), it never recomputes anything client-side.
 * Used identically for both independent_sales and grouped_sale (ADR-027) PaymentRequests.
 */
export function usePaymentStatusPolling(
    status: string | null | undefined,
    refetch: () => void
): void {
    const refetchRef = useRef(refetch);
    useEffect(() => {
        refetchRef.current = refetch;
    });

    const isPending = Boolean(status) && !TERMINAL_STATUSES.has(status as string);

    useEffect(() => {
        if (!isPending) return;

        const startedAt = Date.now();

        const intervalId = setInterval(() => {
            if (Date.now() - startedAt > MAX_POLL_DURATION_MS) {
                clearInterval(intervalId);
                return;
            }
            refetchRef.current();
        }, POLL_INTERVAL_MS);

        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                refetchRef.current();
            }
        };
        const handleFocus = () => refetchRef.current();

        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("focus", handleFocus);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("focus", handleFocus);
        };
    }, [isPending]);
}
