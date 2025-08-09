// Database types for Supabase - will be generated based on schema
export interface Database {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string
          name: string
          adults: number
          teens: number
          kids: number
          toddlers: number
          dietary_restrictions: string[]
          status: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          adults: number
          teens: number
          kids: number
          toddlers: number
          dietary_restrictions?: string[]
          status?: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          adults?: number
          teens?: number
          kids?: number
          toddlers?: number
          dietary_restrictions?: string[]
          status?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      meals: {
        Row: {
          id: string
          title: string
          description: string
          prep_time: number
          steps: string[]
          ingredients: string[]
          tags: string[]
          starred: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          prep_time?: number
          steps?: string[]
          ingredients?: string[]
          tags?: string[]
          starred?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          prep_time?: number
          steps?: string[]
          ingredients?: string[]
          tags?: string[]
          starred?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          week_start: string
          group_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          week_start: string
          group_id: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          week_start?: string
          group_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      plan_meals: {
        Row: {
          id: string
          plan_id: string
          meal_id: string
          day: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          meal_id: string
          day: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          meal_id?: string
          day?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      form_links: {
        Row: {
          id: string
          plan_id: string
          public_token: string
          role: 'co_manager' | 'other'
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          plan_id: string
          public_token: string
          role: 'co_manager' | 'other'
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          plan_id?: string
          public_token?: string
          role?: 'co_manager' | 'other'
          created_at?: string
          expires_at?: string | null
        }
      }
      form_responses: {
        Row: {
          id: string
          form_link_id: string
          form_link_role: 'co_manager' | 'other'
          submitted_at: string
          selections: Record<string, any>
          comments: string | null
        }
        Insert: {
          id?: string
          form_link_id: string
          form_link_role: 'co_manager' | 'other'
          submitted_at?: string
          selections: Record<string, any>
          comments?: string | null
        }
        Update: {
          id?: string
          form_link_id?: string
          form_link_role?: 'co_manager' | 'other'
          submitted_at?: string
          selections?: Record<string, any>
          comments?: string | null
        }
      }
      shopping_lists: {
        Row: {
          id: string
          plan_id: string
          items: Record<string, any>[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          items: Record<string, any>[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          items?: Record<string, any>[]
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_adult_equivalent: {
        Args: { adults: number; teens: number; kids: number; toddlers: number }
        Returns: number
      }
    }
    Enums: {
      group_status: 'active' | 'inactive'
      plan_status: 'draft' | 'collecting' | 'finalized'
      form_link_role: 'co_manager' | 'other'
    }
  }
}