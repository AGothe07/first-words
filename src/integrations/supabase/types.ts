export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agenda_items: {
        Row: {
          all_day: boolean | null
          auto_notify: boolean | null
          color: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          item_type: string
          phone: string | null
          priority: string | null
          recurrence: string | null
          recurrence_end: string | null
          recurrence_interval: number | null
          recurrence_type: string
          recurrence_weekdays: string | null
          reminder_unit: string | null
          reminder_value: number | null
          start_date: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          auto_notify?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          item_type?: string
          phone?: string | null
          priority?: string | null
          recurrence?: string | null
          recurrence_end?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string
          recurrence_weekdays?: string | null
          reminder_unit?: string | null
          reminder_value?: number | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          auto_notify?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          item_type?: string
          phone?: string | null
          priority?: string | null
          recurrence?: string | null
          recurrence_end?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string
          recurrence_weekdays?: string | null
          reminder_unit?: string | null
          reminder_value?: number | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_name: string
          id: string
          processed: boolean | null
          processed_at: string | null
          raw_payload: Json | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_name: string
          id: string
          processed?: boolean | null
          processed_at?: string | null
          raw_payload?: Json | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_name?: string
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          raw_payload?: Json | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          category: string
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          category: string
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      auto_messages: {
        Row: {
          channel: string | null
          created_at: string
          event_id: string | null
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          message_template: string
          send_at_offset_days: number | null
          send_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          message_template: string
          send_at_offset_days?: number | null
          send_time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          message_template?: string
          send_at_offset_days?: number | null
          send_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "important_events"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          period: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          period?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          period?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          created_at: string
          creditor: string
          due_date: string | null
          id: string
          installments: number
          installments_paid: number
          interest_rate: number
          notes: string | null
          remaining_value: number
          start_date: string
          status: string
          total_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creditor: string
          due_date?: string | null
          id?: string
          installments?: number
          installments_paid?: number
          interest_rate?: number
          notes?: string | null
          remaining_value: number
          start_date?: string
          status?: string
          total_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creditor?: string
          due_date?: string | null
          id?: string
          installments?: number
          installments_paid?: number
          interest_rate?: number
          notes?: string | null
          remaining_value?: number
          start_date?: string
          status?: string
          total_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dimension_settings: {
        Row: {
          created_at: string | null
          dimension_key: string
          display_order: number | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dimension_key: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dimension_key?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_checkpoints: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          goal_id: string
          id: string
          is_completed: boolean | null
          target_value: number | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          goal_id: string
          id?: string
          is_completed?: boolean | null
          target_value?: number | null
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          goal_id?: string
          id?: string
          is_completed?: boolean | null
          target_value?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_checkpoints_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          baseline_value: number | null
          color: string | null
          created_at: string
          current_value: number | null
          data_source: string | null
          description: string | null
          goal_type: string
          id: string
          period_end: string | null
          period_start: string | null
          period_type: string | null
          person_ids: string[] | null
          priority: string | null
          progress_mode: string | null
          start_date: string
          status: string
          target_date: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_value?: number | null
          color?: string | null
          created_at?: string
          current_value?: number | null
          data_source?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          person_ids?: string[] | null
          priority?: string | null
          progress_mode?: string | null
          start_date?: string
          status?: string
          target_date?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_value?: number | null
          color?: string | null
          created_at?: string
          current_value?: number | null
          data_source?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          person_ids?: string[] | null
          priority?: string | null
          progress_mode?: string | null
          start_date?: string
          status?: string
          target_date?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          monthly_limit: number | null
          permissions: Json
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          monthly_limit?: number | null
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          monthly_limit?: number | null
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          extra_member_price: number
          id: string
          name: string
          owner_user_id: string
          plan_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_member_price?: number
          id?: string
          name?: string
          owner_user_id: string
          plan_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_member_price?: number
          id?: string
          name?: string
          owner_user_id?: string
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string
          error_details: Json | null
          file_name: string
          id: string
          imported_records: number
          status: string
          total_records: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          file_name: string
          id?: string
          imported_records?: number
          status?: string
          total_records?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          file_name?: string
          id?: string
          imported_records?: number
          status?: string
          total_records?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      important_events: {
        Row: {
          auto_notify: boolean | null
          created_at: string
          event_date: string
          event_type: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          person_name: string | null
          phone: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_notify?: boolean | null
          created_at?: string
          event_date: string
          event_type?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          person_name?: string | null
          phone?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_notify?: boolean | null
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          person_name?: string | null
          phone?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_entries: {
        Row: {
          amount: number
          created_at: string
          date: string
          entry_type: string
          id: string
          investment_id: string
          notes: string | null
          quantity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          entry_type?: string
          id?: string
          investment_id: string
          notes?: string | null
          quantity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          entry_type?: string
          id?: string
          investment_id?: string
          notes?: string | null
          quantity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_entries_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          event_date: string
          id: string
          send_type: string
          sent_at: string | null
          source_id: string
          source_type: string
          user_id: string
          webhook_status: number | null
        }
        Insert: {
          event_date: string
          id?: string
          send_type: string
          sent_at?: string | null
          source_id: string
          source_type: string
          user_id: string
          webhook_status?: number | null
        }
        Update: {
          event_date?: string
          id?: string
          send_type?: string
          sent_at?: string | null
          source_id?: string
          source_type?: string
          user_id?: string
          webhook_status?: number | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          message_template: string
          send_both: boolean | null
          send_days_before: number | null
          send_on_day: boolean | null
          setting_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_template?: string
          send_both?: boolean | null
          send_days_before?: number | null
          send_on_day?: boolean | null
          setting_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_template?: string
          send_both?: boolean | null
          send_days_before?: number | null
          send_on_day?: boolean | null
          setting_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      persons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_enabled: boolean
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_activity: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_activity?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_activity?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string
          created_at: string
          end_date: string | null
          frequency: string
          id: string
          interval_value: number
          is_active: boolean
          last_generated_at: string | null
          next_due_date: string
          notes: string | null
          payment_method_id: string | null
          person_id: string
          project_id: string | null
          subcategory_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id: string
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_value?: number
          is_active?: boolean
          last_generated_at?: string | null
          next_due_date: string
          notes?: string | null
          payment_method_id?: string | null
          person_id: string
          project_id?: string | null
          subcategory_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_value?: number
          is_active?: boolean
          last_generated_at?: string | null
          next_due_date?: string
          notes?: string | null
          payment_method_id?: string | null
          person_id?: string
          project_id?: string | null
          subcategory_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          billing_type: string | null
          confirmed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          net_value: number | null
          raw_payload: Json | null
          received_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: string | null
          confirmed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          net_value?: number | null
          raw_payload?: Json | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: string | null
          confirmed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          net_value?: number | null
          raw_payload?: Json | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          access_expires_at: string | null
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          cancelled_at: string | null
          created_at: string
          customer_cpf_cnpj: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_payment_confirmed_at: string | null
          manual_access_expires_at: string | null
          next_due_date: string | null
          plan_type: Database["public"]["Enums"]["plan_type"]
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used: boolean | null
          updated_at: string
          user_id: string | null
          value: number
        }
        Insert: {
          access_expires_at?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf_cnpj?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_payment_confirmed_at?: string | null
          manual_access_expires_at?: string | null
          next_due_date?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean | null
          updated_at?: string
          user_id?: string | null
          value?: number
        }
        Update: {
          access_expires_at?: string | null
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_cpf_cnpj?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_payment_confirmed_at?: string | null
          manual_access_expires_at?: string | null
          next_due_date?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean | null
          updated_at?: string
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_tags: {
        Row: {
          tag_id: string
          transaction_id: string
        }
        Insert: {
          tag_id: string
          transaction_id: string
        }
        Update: {
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string
          created_at: string
          date: string
          household_id: string | null
          id: string
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          notes: string | null
          payment_method_id: string | null
          person_id: string
          project_id: string | null
          subcategory_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id: string
          created_at?: string
          date: string
          household_id?: string | null
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          notes?: string | null
          payment_method_id?: string | null
          person_id: string
          project_id?: string | null
          subcategory_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string
          created_at?: string
          date?: string
          household_id?: string | null
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          notes?: string | null
          payment_method_id?: string | null
          person_id?: string
          project_id?: string | null
          subcategory_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_financial_snapshot: {
        Row: {
          categories: Json | null
          category_trends: Json | null
          current_month: Json | null
          ingest_schema: string | null
          insights: Json | null
          monthly_history: Json | null
          overview: Json | null
          patrimony: Json | null
          phone: string
          recent_transactions: Json | null
          snapshot_version: number | null
          summary: Json | null
          transactions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Json | null
          category_trends?: Json | null
          current_month?: Json | null
          ingest_schema?: string | null
          insights?: Json | null
          monthly_history?: Json | null
          overview?: Json | null
          patrimony?: Json | null
          phone: string
          recent_transactions?: Json | null
          snapshot_version?: number | null
          summary?: Json | null
          transactions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Json | null
          category_trends?: Json | null
          current_month?: Json | null
          ingest_schema?: string | null
          insights?: Json | null
          monthly_history?: Json | null
          overview?: Json | null
          patrimony?: Json | null
          phone?: string
          recent_transactions?: Json | null
          snapshot_version?: number | null
          summary?: Json | null
          transactions?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          birthday_send_time: string | null
          business_hours_end: string | null
          business_hours_start: string | null
          created_at: string | null
          date_format: string | null
          default_agenda_view: string | null
          default_currency: string | null
          default_event_duration: number | null
          default_event_notify: boolean | null
          default_goal_unit: string | null
          default_person_id: string | null
          events_send_time: string | null
          family_mode_enabled: boolean | null
          financial_month_start: number | null
          font_size: string | null
          goal_progress_mode: string | null
          id: string
          layout_density: string | null
          max_session_hours: number | null
          notifications_enabled: boolean | null
          primary_color: string | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          birthday_send_time?: string | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          date_format?: string | null
          default_agenda_view?: string | null
          default_currency?: string | null
          default_event_duration?: number | null
          default_event_notify?: boolean | null
          default_goal_unit?: string | null
          default_person_id?: string | null
          events_send_time?: string | null
          family_mode_enabled?: boolean | null
          financial_month_start?: number | null
          font_size?: string | null
          goal_progress_mode?: string | null
          id?: string
          layout_density?: string | null
          max_session_hours?: number | null
          notifications_enabled?: boolean | null
          primary_color?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          birthday_send_time?: string | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          date_format?: string | null
          default_agenda_view?: string | null
          default_currency?: string | null
          default_event_duration?: number | null
          default_event_notify?: boolean | null
          default_goal_unit?: string | null
          default_person_id?: string | null
          events_send_time?: string | null
          family_mode_enabled?: boolean | null
          financial_month_start?: number | null
          font_size?: string | null
          goal_progress_mode?: string | null
          id?: string
          layout_density?: string | null
          max_session_hours?: number | null
          notifications_enabled?: boolean | null
          primary_color?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          function_key: string | null
          id: string
          is_active: boolean
          payload_fields: Json
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          function_key?: string | null
          id?: string
          is_active?: boolean
          payload_fields?: Json
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          function_key?: string | null
          id?: string
          is_active?: boolean
          payload_fields?: Json
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          called_at: string
          event_type: string
          id: string
          response_time_ms: number | null
          status_code: number | null
          user_id: string | null
          webhook_config_id: string | null
        }
        Insert: {
          called_at?: string
          event_type?: string
          id?: string
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
          webhook_config_id?: string | null
        }
        Update: {
          called_at?: string
          event_type?: string
          id?: string
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string | null
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string | null
          status: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name?: string | null
          status?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string | null
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_cpf_email_uniqueness: {
        Args: { _cpf: string; _email: string; _user_id?: string }
        Returns: Json
      }
      email_has_used_trial: { Args: { _email: string }; Returns: boolean }
      get_household_dashboard: {
        Args: { _month_end: string; _month_start: string; _user_id: string }
        Returns: Json
      }
      get_household_role: {
        Args: { _household_id: string; _user_id: string }
        Returns: string
      }
      get_user_household_id: { Args: { _user_id: string }; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      has_valid_access: { Args: { _user_id: string }; Returns: boolean }
      is_household_member: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_brazilian_phone: { Args: { input: string }; Returns: string }
      rebuild_financial_snapshot: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      rebuild_ingest_schema_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      rebuild_user_snapshot: { Args: { p_user_id: string }; Returns: undefined }
      seed_default_dimensions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      payment_status:
        | "pending"
        | "confirmed"
        | "received"
        | "overdue"
        | "refunded"
        | "chargeback"
      plan_type: "monthly" | "annual"
      subscription_status:
        | "active"
        | "inactive"
        | "pending"
        | "cancelled"
        | "overdue"
        | "trial_active"
        | "trial_expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      payment_status: [
        "pending",
        "confirmed",
        "received",
        "overdue",
        "refunded",
        "chargeback",
      ],
      plan_type: ["monthly", "annual"],
      subscription_status: [
        "active",
        "inactive",
        "pending",
        "cancelled",
        "overdue",
        "trial_active",
        "trial_expired",
      ],
    },
  },
} as const
