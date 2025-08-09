# 🧪 Meal Planning SaaS — Lean MVP Product Requirements Document (PRD)

---

## Executive Summary

This project is a group-based meal planning web application that automates weekly meal suggestion collection, enables collaborative decision-making through two distinct shared links, and generates organized shopping lists. It is designed for household managers to coordinate meals without modeling individual members. Serving calculations scale based on demographic counts for adults, teens, kids, and toddlers. The system ensures the right ingredients are available, in the right quantities, at the right time.

---

## Development Methodology

The application will be developed using a **modular, component-based approach**, building each piece in a logical sequence that supports iterative delivery. Development will follow **test-first principles**, with **unit tests written before any component logic**.  

All code will be written in **TypeScript**, using Supabase’s auto-generated types, and will follow modern best practices for modularity, maintainability, scalability, and security.

---

## Component Build Order

| Order | Component Name              | Purpose                                                                 |
|-------|-----------------------------|-------------------------------------------------------------------------|
| 1     | Group Editor                 | Create/edit groups, set demographics and dietary restrictions          |
| 2     | AE (Adult-Equivalent) Calculator | Compute serving totals from demographic counts                    |
| 3     | Meal Generator               | Create meal options via AI or pull from stored recipes                  |
| 4     | Meal Card                    | Display meal details, ingredients, and star toggle                     |
| 5     | Plan Creator                  | Create a plan and generate two FormLinks                                |
| 6     | Form Renderer                 | Load meals for participant selection via public token                   |
| 7     | Form Submission Handler       | Store responses in the database with role attribution                   |
| 8     | Conflict Resolver             | Apply co‑manager override rules                                         |
| 9     | Plan Finalizer                | Save final selections and trigger scaling                               |
| 10    | Shopping List Generator       | Aggregate and categorize scaled ingredients                             |
| 11    | Notification Sender           | Email notifications for submissions and plan finalization               |
| 12    | Dashboard                     | Manager’s overview of group, plans, responses, and shopping lists       |

Each component will be testable in isolation, designed for reusability, and integrated progressively.

---

## Goals

- Enable group meal planning without tracking individual member accounts
- Scale ingredient quantities based on demographic counts and weights
- Provide two link types per plan for collaborative decision-making
- Notify the manager of any form submission
- Allow plan adjustments with instant serving recalculation
- Generate categorized shopping lists from finalized plans
- Allow managers to star meals for future reuse

---

## Non-Goals

- Individual user accounts for participants
- Multiple group memberships for a single user
- Pantry inventory tracking
- Grocery service API integration
- Calendar-based scheduling or drag-and-drop planning
- Offline form completion or draft saving

---

## Process Flow

### Step 1 — Meal Options Generation
- Trigger: Manager starts a new weekly plan
- Input: Group demographics and dietary restrictions
- Process: AI generates N meal options with scaled ingredients
- Output: Meals stored in `Meal` table

### Step 2 — Dual FormLink Creation
- Trigger: Meals are ready for a plan
- Process: Create `Plan` record and two `FormLink` records:
  - Co‑manager link (authoritative)
  - Other participant link (advisory)
- Output: Two unique, public URLs with roles stored in Supabase

### Step 3 — Meal Selection Phase
- Input: Participant opens a FormLink
- Process:
  - Loads available meals
  - Captures selections
  - Stores `FormResponse` with associated role
- Conflict Rule: Co‑manager overrides conflicting participant choices

### Step 4 — Plan Finalization
- Trigger: Manager reviews submissions
- Process:
  - Apply conflict resolution
  - Save final selections to `PlanMeal`
  - Trigger ingredient scaling RPC

### Step 5 — Shopping List Generation
- Trigger: Plan finalized
- Process:
  - Aggregate ingredients from chosen meals
  - Apply AE scaling factor
  - Categorize and deduplicate
- Output: Stored in `ShoppingList` table

---

## ASCII Flow Diagram

```
[ AI Meal Generation ]
        ↓
[ Plan + Dual FormLinks Created ]
        ↙               ↘
Co‑Manager Link     Other Participant Link
        ↓               ↓
  FormResponse(role=cm)  FormResponse(role=other)
        ↘               ↙
  Conflict Resolution Rule Applied
        ↓
  Final Plan → Scaled Ingredients
        ↓
  Categorized Shopping List
```

---

## Target Users

**Household Manager**
- Creates groups and defines demographics
- Shares form links
- Finalizes plans
- Stars meals for reuse

**Household Participants**
- Receive a link and submit meal preferences anonymously

---

## User Stories

- As a manager, I can create a group with demographic counts and dietary restrictions
- As a manager, I can generate two shareable form links for each plan
- As a participant, I can submit preferences without logging in
- As a manager, I can finalize a plan applying co‑manager overrides
- As a manager, I can generate a categorized shopping list
- As a manager, I can mark meals as starred for reuse

---

## Functional Requirements

### Group Management
- Create, edit, archive groups
- Set demographics: adults, teens, kids, toddlers
- Store dietary restrictions
- Compute AE total

### Meal Generation
- Accept group input for AI generation
- Store meals with name, ingredients, and servings
- Optionally attach images via Supabase Storage

### FormLink System
- Generate and store two links with roles
- Associate responses with the originating link and role
- Apply override rules in finalization

### Plan Finalization
- Review submissions
- Save final selection set
- Adjust ingredient quantities with AE scaling

### Shopping List
- Combine all meal ingredients
- Scale, deduplicate, and categorize items

### Meal Feedback
- Star/unstar meals
- Filter by starred in future selection

---

## Serving Calculation

| Demographic | AE Weight |
|-------------|-----------|
| Adult       | 1.0       |
| Teen        | 1.2       |
| Kid         | 0.7       |
| Toddler     | 0.4       |

**Formula:**  
`AE = (Adults × 1.0) + (Teens × 1.2) + (Kids × 0.7) + (Toddlers × 0.4)`

---

## Data Model

**Group:** id, name, adults, teens, kids, toddlers, dietary_restrictions[], status  
**Seasonality:** ingredient_name, start_month, end_month, region  
**Meal:** id, title, description, prep_time, steps[], ingredients[], tags[], starred  
**Plan:** id, week_start, group_ids[], status  
**PlanMeal:** id, plan_id, meal_id, day, notes  
**FormLink:** id, plan_id, public_token, role  
**FormResponse:** id, form_link_id, form_link_role, submitted_at, selections[], comments  
**ShoppingList:** id, plan_id, items[]

---

## API Example

`POST /api/forms`  
```json
{
  "plan_id": "plan_456"
}
```

**Response:**  
```json
{
  "links": [
    {"role": "co_manager", "url": "https://app/f/cm123"},
    {"role": "other", "url": "https://app/f/ot456"}
  ]
}
```

---

## UI/UX Requirements

- Group editor with demographic inputs
- Meal cards with ingredient list and star toggle
- Clear role labeling for form links
- Manager dashboard with response summaries
- Categorized shopping list with share/print options

---

## Notifications

- Email to manager when a form response is submitted
- Email on plan finalization

---

## Technical Stack

| Layer         | Technology                                   |
|---------------|----------------------------------------------|
| Language      | **TypeScript**                               |
| Frontend      | Next.js or Astro                             |
| Styling       | Tailwind CSS                                 |
| Backend       | Supabase (PostgreSQL, Auth, Storage, RPCs)   |
| Auth          | Supabase Auth                                |
| Email         | Supabase Email or Resend                     |
| AI Integration| Claude Code                                  |
| Testing       | Unit tests (test-first), Playwright optional |
| Analysis      | Semgrep optional                             |
| Dev Tools     | Supabase CLI, Claude Code                    |

---

## Acceptance Criteria

- All components built in defined order, each with passing unit tests
- Two form URLs per plan with correct roles
- Conflict resolution applied correctly
- Shopping list matches AE scaling rules
- All logic implemented in TypeScript using Supabase types
- Adherence to modern best practices in architecture and security