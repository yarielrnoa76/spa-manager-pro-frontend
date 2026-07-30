// The /vitest entry point extends Vitest's own `expect` (imported from 'vitest', not a global),
// so this works without enabling vitest.config.ts's `globals: true` option.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without globals:true, @testing-library/react's automatic afterEach(cleanup) registration
// never fires (it detects a global `afterEach`, which doesn't exist here), so each test file
// would otherwise leak the previous test's DOM into the next one. Register it explicitly instead.
afterEach(() => {
    cleanup();
});
