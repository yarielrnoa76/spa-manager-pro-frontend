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

**Running a single test file**: This project does not have a test framework configured.

## Code Style Guidelines

### General Conventions

- **Language**: TypeScript with React
- **Strings**: Use double quotes `"` consistently
- **Indentation**: 2 spaces
- **File extensions**: `.tsx` for React components, `.ts` for utilities/types

### Imports (ordered by group, blank line between)

```tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { LayoutDashboard, DollarSign } from "lucide-react";

import { api } from "./services/api";
import Dashboard from "./pages/Dashboard";
```

1. React core imports
2. External libraries (react-router-dom, lucide-react, recharts)
3. Internal app imports (services, components, pages)

### Types

- Use explicit TypeScript types for props and state
- Use `React.FC<Props>` for functional component typing
- Use `any` sparingly (acceptable for flexible backend data)
- Define shared types in `src/types.ts`

### Naming Conventions

- **Components/Files**: PascalCase (e.g., `Dashboard`, `StatCard`)
- **Utilities**: camelCase (e.g., `api.ts`, `utils.ts`)
- **Props/Variables**: camelCase
- **Types/Interfaces**: PascalCase

### Component Structure

```tsx
interface Props { ... }

const ComponentName: React.FC<Props> = ({ prop1 }) => {
  const [state, setState] = useState<Type>(defaultValue);

  useEffect(() => { ... }, [dependencies]);

  const computed = useMemo(() => { ... }, [dependencies]);

  return <div>...</div>;
};

export default ComponentName;
```

### Error Handling

- Use custom `ApiError` class from `src/services/api.ts`
- Handle 401 (unauthorized) by clearing tokens and redirecting to login
- Handle 422 (validation errors) with proper error messages
- Handle 204 (No Content) for DELETE operations

```tsx
try {
  const data = await api.someMethod();
  setData(data);
} catch (e: any) {
  setError(e?.message || "Failed to load data");
}
```

### State Management

- Use `useState` for local state, `useMemo` for expensive computations
- Use `useCallback` for functions passed as props
- Use `useEffect` with cleanup for async operations:

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
- Use methods: `get(path)`, `post(path, body)`, `put(path, body)`, `delete(path)`
- Environment variables: `import.meta.env.VITE_*`

### Tailwind CSS

- Use utility classes in `className`
- Common colors: `indigo-600`, `emerald-600`, `amber-500`, `rose-500`
- Responsive: `md:`, `lg:` prefixes

### ESLint

- Plugins: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Run `npm run lint` before committing

### Path Aliases

Use `@/*` instead of relative paths:
```tsx
// Instead of: import { api } from "../../services/api";
import { api } from "@/services/api";
```

### Common Patterns

**Loading**: `if (loading) return <div>Loading...</div>;`
**Error**: `if (error) return <div className="text-red-600">{error}</div>;`

### What NOT to Do

- Avoid unnecessary `any` types
- No `console.log` in production
- No secrets in code (use `.env` files)
- Avoid `eslint-disable` unless necessary
