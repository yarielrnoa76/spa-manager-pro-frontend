# AGENTS.md - Developer Guidelines for SPA Manager Pro Frontend

## Project Overview

- **Tech Stack**: React 19, TypeScript, Vite 7, React Router DOM 7
- **UI**: Tailwind CSS (via className), Lucide React icons
- **Charts**: Recharts
- **Backend**: REST API at `VITE_API_URL` (defaults to `http://127.0.0.1:8000`)

## Build / Lint / Test Commands

```bash
# Development
npm run dev          # Start Vite dev server with HMR

# Build
npm run build        # Run TypeScript compilation + Vite build
npm run preview      # Preview production build locally

# Linting
npm run lint         # Run ESLint on all files
```

**Running a single test file**: This project does not have a test framework configured. If tests are added later, typically:
- Vitest: `npx vitest run src/path/to/file.test.ts`
- Jest: `npx jest src/path/to/file.test.ts`

## Code Style Guidelines

### General Conventions

- **Language**: TypeScript with React
- **Strings**: Use double quotes `"` consistently
- **Indentation**: 2 spaces (follows Vite/ESLint defaults)
- **File extensions**: `.tsx` for React components, `.ts` for utilities/types

### Imports

Organize imports in the following order (blank line between groups):

```tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, DollarSign } from "lucide-react";

import { api } from "./services/api";
import Dashboard from "./pages/Dashboard";
import StatCard from "../components/StatCard";
```

1. React core imports
2. External library imports (react-router-dom, lucide-react, recharts)
3. Internal app imports (services, components, pages)

### Types

- Use explicit TypeScript types for props and state
- Use `React.FC<Props>` for functional component typing
- Use `any` sparingly - acceptable for flexible backend data handling (e.g., `res: any`)
- Define types near usage or in `src/types.ts` for shared types

```tsx
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: string;
  trendUp?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend, trendUp }) => (
  // ...
);
```

### Naming Conventions

- **Components**: PascalCase (e.g., `Dashboard`, `StatCard`, `Appointments`)
- **Files**: PascalCase for components (`.tsx`), camelCase for utilities (`.ts`)
- **Props**: camelCase
- **Types/Interfaces**: PascalCase

### Component Structure

```tsx
// 1. Type definitions
interface Props {
  // ...
}

// 2. Component definition
const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // 3. Hooks first
  const [state, setState] = useState<Type>(defaultValue);
  
  // 4. Effects
  useEffect(() => {
    // effect logic
  }, [dependencies]);
  
  // 5. Memoized values
  const computed = useMemo(() => {
    // ...
  }, [dependencies]);
  
  // 6. Render
  return (
    <div>...</div>
  );
};

export default ComponentName;
```

### Error Handling

- Use custom `ApiError` class for API errors (defined in `src/services/api.ts`)
- Handle 401 (unauthorized) by clearing tokens and redirecting to login
- Handle 422 (validation errors) with proper error messages
- Handle 204 (No Content) appropriately for DELETE operations

```tsx
try {
  const data = await api.someMethod();
  setData(data);
} catch (e: any) {
  setError(e?.message || "Failed to load data");
}
```

### State Management

- Use `useState` for local component state
- Use `useMemo` for expensive computations
- Use `useCallback` for functions passed as props
- Use `useEffect` with cleanup functions for async operations

```tsx
useEffect(() => {
  let cancelled = false;
  
  const fetchData = async () => {
    const result = await api.getData();
    if (!cancelled) setData(result);
  };
  
  fetchData();
  return () => { cancelled = true; };
}, [dependencies]);
```

### API Layer

- All API calls go through `src/services/api.ts`
- Use the `api` object which provides:
  - `get(path)`, `post(path, body)`, `put(path, body)`, `delete(path)`
  - Typed methods like `login()`, `listSales()`, `createProduct()`
- Environment variables accessed via `import.meta.env.VITE_*`

### Tailwind CSS

- Use utility classes directly in `className`
- Common colors: `indigo-600`, `emerald-600`, `amber-500`, `rose-500`, `gray-50`, etc.
- Responsive: `md:`, `lg:` prefixes

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard ... />
</div>
```

### ESLint Rules

The project uses:
- `@eslint/js` - JavaScript recommended rules
- `typescript-eslint` - TypeScript support
- `eslint-plugin-react-hooks` - React hooks rules
- `eslint-plugin-react-refresh` - Hot reload safety

Run `npm run lint` before committing. Fix warnings/errors.

### Path Aliases

The project configures a path alias:
- `@/*` maps to `./*`

```tsx
// Instead of:
import { api } from "../../services/api";

// Use:
import { api } from "@/services/api";
```

### Common Patterns

**Loading states**:
```tsx
if (loading) return <div className="p-8 font-semibold">Loading...</div>;
```

**Error states**:
```tsx
if (error) return <div className="p-8 text-red-600">{error}</div>;
```

**Conditional rendering**:
```tsx
{data?.length === 0 ? (
  <div>No data available</div>
) : (
  <div>{data.map(item => ...)}</div>
)}
```

### What NOT to Do

- Do not use `any` unnecessarily (only for flexible backend data)
- Do not leave `console.log` statements in production code
- Do not commit secrets or API keys (use `.env` files)
- Do not use `eslint-disable` without good reason
