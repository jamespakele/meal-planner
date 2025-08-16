# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to understand the Meal Planner SaaS project.

## Project Overview

This is a group-based meal planning application that uses a dual-link system for collaborative decision-making. The application is built with Next.js, TypeScript, and Tailwind CSS for the frontend, and Supabase for the backend, including PostgreSQL, authentication, and real-time features.

The core features of the application include:

*   **Group Demographics:** Users can define groups with adults, teens, kids, and toddlers to automatically calculate serving sizes.
*   **AI Meal Generation:** The application generates meal options based on group composition and dietary restrictions.
*   **Dual-Link System:** The application uses a dual-link system with co-manager links for authoritative selections and other participant links for advisory input.
*   **Shopping Lists:** The application automatically generates categorized shopping lists based on finalized meal plans.
*   **Adult-Equivalent Scaling:** Ingredients are scaled using demographic weights to ensure accurate portion sizes.

## Application Architecture

### Core System Design
The application follows a **dual-link collaborative selection model**:

- **Groups**: Define demographic composition (adults, teens, kids, toddlers) and dietary restrictions
- **AI Meal Generation**: Creates scaled meal options based on group demographics and seasonality
- **Dual Form Links**: Each meal plan generates two types of shareable links:
  - **Co-manager link**: Authoritative selections that override conflicts
  - **Other participant link**: Advisory input only
- **Conflict Resolution**: Co-manager choices automatically override other participant choices
- **Shopping Lists**: Auto-generated from finalized plans with ingredient scaling

### Key Entities and Relationships
- **Group** → defines demographics and dietary restrictions
- **Plan** → contains meal options for a specific week
- **FormLink** → dual links with roles (`co_manager` / `other`)
- **FormResponse** → captures participant selections with role context
- **PlanMeal** → finalized meal selections
- **ShoppingList** → aggregated and categorized ingredients

### Serving Calculation System
Uses Adult-Equivalent (AE) scaling:
- Adults: 1.0x
- Teens: 1.2x
- Kids: 0.7x
- Toddlers: 0.4x

## Technical Stack

*   **Frontend**: React/Next.js
*   **Backend**: Node.js with PostgreSQL
*   **Authentication**: Manager login + public token links for forms
*   **Email**: Transactional notifications
*   **AI Integration**: Meal generation service

## Development Status

⚠️ **Pre-development Phase**: No code has been implemented yet. The project contains only the PRD specification in `prd.md`. When implementing:

1. Start with database schema based on the data model in `prd.md:178-187`
2. Focus on the core workflow: Group creation → AI meal generation → Dual link system → Plan finalization → Shopping list generation
3. Implement conflict resolution logic where co-manager responses override other responses
4. Pay attention to the serving calculation formulas for ingredient scaling

## Key Implementation Priorities

1. **Dual Link System**: Critical differentiator - ensure role-based form links work correctly
2. **Conflict Resolution**: Co-manager override logic must be bulletproof
3. **Serving Calculations**: AE-based ingredient scaling is core to the value proposition
4. **Group Demographics**: Simple counters without individual member modeling

## Important Constraints

- **No individual family member accounts** - only group-level demographics
- **No multi-group assignments** per member
- **No cooking responsibility tracking** in MVP
- **No pantry inventory** in MVP
- **No calendar integration** in MVP

Refer to `prd.md` for complete functional requirements, user stories, and technical specifications.

## Common Commands

### Development
- **Start development server**: `npm run dev`
- **Build for production**: `npm run build`
- **Start production server**: `npm run start`
- **Run linting**: `npm run lint`

### Testing
- **Run end-to-end tests**: `npm run test` (alias for `npx playwright test`)
- **Run tests in headed mode**: `npm run test:headed`
- **Run specific test file**: `npx playwright test tests/example.spec.ts`
- **Show test report**: `npx playwright show-report`
- **Install browsers**: `npx playwright install`

### Project Setup
- **Install dependencies**: `npm install`
- **Initialize new tests**: `npx playwright codegen` (generates tests by recording user actions)

## Development Environment Setup Complete ✅

The project now includes:
- **Full Next.js 15 application** with TypeScript and Tailwind CSS
- **Supabase integration** with client libraries and type definitions
- **Google OAuth authentication** via Supabase Auth
- **Database schema** with migrations for all core entities
- **API routes** implementing dual-link system and conflict resolution
- **Protected routes** and authentication components
- **Dashboard interface** for authenticated users

## Next Steps for Implementation

1. **Set up Supabase project**: Create account, run migrations, configure Google OAuth
2. **Update environment variables**: Add actual Supabase credentials to `.env.local`
3. **Test authentication flow**: Verify Google OAuth login works
4. **Implement meal generation**: Add AI service integration for meal suggestions
5. **Build form interface**: Create public meal selection forms
6. **Add real-time notifications**: Implement manager notifications on form submissions
7. **Enhanced UI**: Build comprehensive group/plan management interfaces

## Development Conventions

*   **Coding Style:** The project uses Prettier for code formatting and ESLint for code quality.
*   **Testing:** The project uses Jest for unit and integration tests and Playwright for end-to-end tests.
*   **Authentication:** The project uses Supabase Auth with Google OAuth for authentication.
*   **Database:** The project uses Supabase with a PostgreSQL database. Migrations are located in the `supabase/migrations` directory.
*   **State Management:** The project uses React's built-in state management features (`useState`, `useEffect`, `useMemo`).
*   **Component Structure:** The project uses a standard React component structure, with components located in the `src/components` directory.

## Key Files

*   **`README.md`**: The main README file for the project.
*   **`package.json`**: The package.json file, which contains the project's dependencies and scripts.
*   **`next.config.js`**: The Next.js configuration file.
*   **`supabase/migrations`**: The directory containing the database schema and migrations.
*   **`src/app/dashboard/page.tsx`**: The main dashboard page for the application.
*   **`src/components/DashboardContent.tsx`**: The main content component for the dashboard.
*   **`src/lib/mealGenerationService.ts`**: The service responsible for generating meals.
*   **`src/lib/mealGenerator.ts`**: The core meal generation logic.