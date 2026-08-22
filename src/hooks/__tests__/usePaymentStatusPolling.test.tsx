import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePaymentStatusPolling } from '../usePaymentStatusPolling';

describe('usePaymentStatusPolling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('refetches on an interval while the status is pending (link_generated)', () => {
        const refetch = vi.fn();
        renderHook(() => usePaymentStatusPolling('link_generated', refetch));

        expect(refetch).not.toHaveBeenCalled();

        vi.advanceTimersByTime(5000);
        expect(refetch).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(5000);
        expect(refetch).toHaveBeenCalledTimes(2);
    });

    it('stops polling once a terminal status is reached', () => {
        const refetch = vi.fn();
        const { rerender } = renderHook(
            ({ status }) => usePaymentStatusPolling(status, refetch),
            { initialProps: { status: 'link_generated' as string | null } }
        );

        vi.advanceTimersByTime(5000);
        expect(refetch).toHaveBeenCalledTimes(1);

        rerender({ status: 'paid' });
        refetch.mockClear();

        // No further ticks should trigger a refetch once the status is terminal.
        vi.advanceTimersByTime(20000);
        expect(refetch).not.toHaveBeenCalled();
    });

    it('refetches immediately when the tab regains visibility/focus, independent of the poll interval', () => {
        const refetch = vi.fn();
        renderHook(() => usePaymentStatusPolling('pending', refetch));

        expect(refetch).not.toHaveBeenCalled();

        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(refetch).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event('focus'));
        expect(refetch).toHaveBeenCalledTimes(2);
    });

    it('never polls or listens when there is no active payment request', () => {
        const refetch = vi.fn();
        renderHook(() => usePaymentStatusPolling(null, refetch));

        vi.advanceTimersByTime(20000);
        window.dispatchEvent(new Event('focus'));
        expect(refetch).not.toHaveBeenCalled();
    });
});
