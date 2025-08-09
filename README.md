# Meal Planner SaaS

Group-based meal planning application with collaborative decision-making through dual-link system.

## Features

- **Group Demographics**: Define groups with adults, teens, kids, and toddlers for automatic serving calculations
- **AI Meal Generation**: Generate meal options based on group composition and dietary restrictions
- **Dual-Link System**: 
  - Co-manager links (authoritative selections)
  - Other participant links (advisory input)
  - Conflict resolution with co-manager override
- **Shopping Lists**: Auto-generated and categorized based on finalized meal plans
- **Adult-Equivalent Scaling**: Ingredients scaled using demographic weights

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Authentication**: Supabase Auth with Google OAuth
- **Testing**: Playwright for end-to-end testing

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Update `.env.local` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

3. **Set up Supabase database**:
   - Create a new Supabase project
   - Run the migration files in order:
     - `001_initial_schema.sql`
     - `002_row_level_security.sql` 
     - `003_sample_data.sql`

4. **Configure Google OAuth**:
   - Set up Google Cloud Console project
   - Add OAuth credentials to Supabase Auth settings
   - Configure redirect URLs

5. **Run the development server**:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Playwright tests
- `npm run test:headed` - Run Playwright tests in headed mode

## Adult-Equivalent Scaling

The application uses Adult-Equivalent (AE) scaling for ingredient calculations:

- **Adults**: 1.0x
- **Teens**: 1.2x  
- **Kids**: 0.7x
- **Toddlers**: 0.4x

**Formula**: `AE = (Adults × 1.0) + (Teens × 1.2) + (Kids × 0.7) + (Toddlers × 0.4)`

## Project Structure

```
src/
├── app/                 # Next.js app directory
├── components/          # React components
├── lib/                 # Utility functions and configurations
│   └── supabase.ts     # Supabase client setup
└── types/              # TypeScript type definitions
    ├── database.ts     # Database schema types
    └── index.ts        # Application types

supabase/
└── migrations/         # Database migration files
    ├── 001_initial_schema.sql
    ├── 002_row_level_security.sql
    └── 003_sample_data.sql
```

## Database Schema

### Core Tables

- **groups** - Group demographics and dietary restrictions
- **meals** - Meal recipes with ingredients and instructions
- **plans** - Weekly meal plans
- **plan_meals** - Finalized meal selections
- **form_links** - Dual-link system (co_manager/other roles)
- **form_responses** - Participant meal selections
- **shopping_lists** - Generated ingredient lists

### Key Relationships

- Groups have many Plans
- Plans have many PlanMeals and FormLinks
- FormLinks have many FormResponses
- Plans have one ShoppingList

## Deployment

The application is designed to deploy easily to Vercel with Supabase as the backend.

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

## License

ISC