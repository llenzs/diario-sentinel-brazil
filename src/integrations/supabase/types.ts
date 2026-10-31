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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          ai_confidence_threshold: number
          created_at: string
          id: number
          instance_name: string
          notification_throttle_minutes: number
          signup_mode: string
          updated_at: string
        }
        Insert: {
          ai_confidence_threshold?: number
          created_at?: string
          id?: number
          instance_name?: string
          notification_throttle_minutes?: number
          signup_mode?: string
          updated_at?: string
        }
        Update: {
          ai_confidence_threshold?: number
          created_at?: string
          id?: number
          instance_name?: string
          notification_throttle_minutes?: number
          signup_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          created_at: string
          id: number
          metadata: Json | null
          target_id: string | null
          target_table: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      eval_dataset: {
        Row: {
          created_at: string
          expected_category: Database["public"]["Enums"]["match_category"]
          expected_is_false_positive: boolean
          id: string
          notes: string | null
          source_context_hint: string | null
          source_excerpt: string
          source_term_label: string
        }
        Insert: {
          created_at?: string
          expected_category: Database["public"]["Enums"]["match_category"]
          expected_is_false_positive: boolean
          id?: string
          notes?: string | null
          source_context_hint?: string | null
          source_excerpt: string
          source_term_label: string
        }
        Update: {
          created_at?: string
          expected_category?: Database["public"]["Enums"]["match_category"]
          expected_is_false_positive?: boolean
          id?: string
          notes?: string | null
          source_context_hint?: string | null
          source_excerpt?: string
          source_term_label?: string
        }
        Relationships: []
      }
      eval_runs: {
        Row: {
          by_category: Json | null
          created_at: string
          fp_rate_pct: number | null
          id: string
          model: string
          notes: string | null
          precision_pct: number | null
          recall_pct: number | null
          total: number
        }
        Insert: {
          by_category?: Json | null
          created_at?: string
          fp_rate_pct?: number | null
          id?: string
          model: string
          notes?: string | null
          precision_pct?: number | null
          recall_pct?: number | null
          total: number
        }
        Update: {
          by_category?: Json | null
          created_at?: string
          fp_rate_pct?: number | null
          id?: string
          model?: string
          notes?: string | null
          precision_pct?: number | null
          recall_pct?: number | null
          total?: number
        }
        Relationships: []
      }
      integration_configs: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          last_test_error: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_secrets: {
        Row: {
          created_at: string
          last4: string | null
          provider: string
          secret_name: string
          updated_at: string
          vault_id: string
        }
        Insert: {
          created_at?: string
          last4?: string | null
          provider: string
          secret_name: string
          updated_at?: string
          vault_id: string
        }
        Update: {
          created_at?: string
          last4?: string | null
          provider?: string
          secret_name?: string
          updated_at?: string
          vault_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          ai_category: Database["public"]["Enums"]["match_category"] | null
          ai_confidence: number | null
          ai_decision_reason: string | null
          ai_model: string | null
          ai_processed_at: string | null
          ai_summary: string | null
          archived_at: string | null
          created_at: string
          excerpt: string
          flagged: boolean
          id: string
          is_false_positive: boolean
          publication_date: string | null
          publication_id: string
          read_at: string | null
          term_id: string
          term_label_snapshot: string | null
          updated_at: string
          user_id: string
          user_note: string | null
        }
        Insert: {
          ai_category?: Database["public"]["Enums"]["match_category"] | null
          ai_confidence?: number | null
          ai_decision_reason?: string | null
          ai_model?: string | null
          ai_processed_at?: string | null
          ai_summary?: string | null
          archived_at?: string | null
          created_at?: string
          excerpt: string
          flagged?: boolean
          id?: string
          is_false_positive?: boolean
          publication_date?: string | null
          publication_id: string
          read_at?: string | null
          term_id: string
          term_label_snapshot?: string | null
          updated_at?: string
          user_id: string
          user_note?: string | null
        }
        Update: {
          ai_category?: Database["public"]["Enums"]["match_category"] | null
          ai_confidence?: number | null
          ai_decision_reason?: string | null
          ai_model?: string | null
          ai_processed_at?: string | null
          ai_summary?: string | null
          archived_at?: string | null
          created_at?: string
          excerpt?: string
          flagged?: boolean
          id?: string
          is_false_positive?: boolean
          publication_date?: string | null
          publication_id?: string
          read_at?: string | null
          term_id?: string
          term_label_snapshot?: string | null
          updated_at?: string
          user_id?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_publication_fkey"
            columns: ["publication_id", "publication_date"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id", "publication_date"]
          },
          {
            foreignKeyName: "matches_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error: string | null
          id: string
          match_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          id?: string
          match_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error?: string | null
          id?: string
          match_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: string
          notify_email: boolean
          notify_whatsapp: boolean
          onboarding_state: Json
          onboarding_status: string
          onboarding_step: number
          phone_e164: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          notify_email?: boolean
          notify_whatsapp?: boolean
          onboarding_state?: Json
          onboarding_status?: string
          onboarding_step?: number
          phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          notify_email?: boolean
          notify_whatsapp?: boolean
          onboarding_state?: Json
          onboarding_status?: string
          onboarding_step?: number
          phone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      publications_default: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_01: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_02: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_03: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_04: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_05: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_06: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_07: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_08: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_09: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_10: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_11: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2025_12: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_01: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_02: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_03: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_04: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_05: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_06: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_07: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_08: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_09: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_10: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_11: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2026_12: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_01: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_02: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_03: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_04: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_05: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_06: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_07: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_08: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_09: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_10: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_11: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2027_12: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_01: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_02: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_03: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_04: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_05: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_06: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_07: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_08: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_09: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_10: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_11: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      publications_p2028_12: {
        Row: {
          content_hash: string
          created_at: string
          external_id: string | null
          id: string
          publication_date: string
          raw_text: string
          section: string | null
          source_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date: string
          raw_text: string
          section?: string | null
          source_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          external_id?: string | null
          id?: string
          publication_date?: string
          raw_text?: string
          section?: string | null
          source_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      scrape_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          pages_processed: number
          publication_date: string
          source_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["scrape_status"]
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          pages_processed?: number
          publication_date: string
          source_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_status"]
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          pages_processed?: number
          publication_date?: string
          source_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scrape_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          adapter_config: Json
          city: string | null
          code: string
          created_at: string
          enabled: boolean
          id: string
          level: Database["public"]["Enums"]["source_level"]
          name: string
          scraper_adapter: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          adapter_config?: Json
          city?: string | null
          code: string
          created_at?: string
          enabled?: boolean
          id?: string
          level: Database["public"]["Enums"]["source_level"]
          name: string
          scraper_adapter?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          adapter_config?: Json
          city?: string | null
          code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          level?: Database["public"]["Enums"]["source_level"]
          name?: string
          scraper_adapter?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      term_sources: {
        Row: {
          source_id: string
          term_id: string
        }
        Insert: {
          source_id: string
          term_id: string
        }
        Update: {
          source_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_sources_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          active: boolean
          color: string | null
          context_hint: string | null
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          match_type: Database["public"]["Enums"]["match_type"]
          notes: string | null
          pattern: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          context_hint?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          match_type?: Database["public"]["Enums"]["match_type"]
          notes?: string | null
          pattern: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string | null
          context_hint?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          match_type?: Database["public"]["Enums"]["match_type"]
          notes?: string | null
          pattern?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ab_test_stats: {
        Row: {
          avg_confidence: number | null
          avg_confidence_tp: number | null
          fp_pct: number | null
          model: string | null
          total: number | null
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          day: string | null
          matches_real: number | null
          matches_total: number | null
          notifications_dlq: number | null
          notifications_sent: number | null
          notifications_total: number | null
          publications_count: number | null
          scrape_runs_failed: number | null
          scrape_runs_success: number | null
          scrape_runs_total: number | null
        }
        Relationships: []
      }
      integration_status: {
        Row: {
          enabled: boolean | null
          last_test_error: string | null
          last_test_ok: boolean | null
          last_tested_at: string | null
          provider: string | null
        }
        Insert: {
          enabled?: boolean | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider?: string | null
        }
        Update: {
          enabled?: boolean | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          last_tested_at?: string | null
          provider?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _internal_get_integration_secrets: {
        Args: { _provider: string }
        Returns: Json
      }
      admin_apply_runtime: {
        Args: {
          _anon_key: string
          _cron_enabled?: boolean
          _functions_url: string
        }
        Returns: undefined
      }
      admin_create_invite: {
        Args: {
          _email: string
          _role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          expires_at: string
          id: string
          token: string
        }[]
      }
      admin_integration_secret_status: {
        Args: { _provider: string }
        Returns: {
          configured: boolean
          last4: string
          secret_name: string
          updated_at: string
        }[]
      }
      admin_list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          last_run_at: string
          last_status: string
          schedule: string
        }[]
      }
      admin_list_integration_secrets: {
        Args: { _provider: string }
        Returns: {
          secret_name: string
          updated_at: string
        }[]
      }
      admin_list_invites: {
        Args: never
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_remove_integration_secret: {
        Args: { _provider: string; _secret_name: string }
        Returns: undefined
      }
      admin_retry_notification: { Args: { _id: string }; Returns: undefined }
      admin_retry_scrape_run: { Args: { _id: string }; Returns: undefined }
      admin_revoke_invite: { Args: { _id: string }; Returns: undefined }
      admin_run_orchestrator: { Args: never; Returns: number }
      admin_run_source: {
        Args: { _date?: string; _source_id: string }
        Returns: undefined
      }
      admin_set_cron_active: {
        Args: { _active: boolean; _jobname: string }
        Returns: undefined
      }
      admin_set_integration_secret: {
        Args: { _provider: string; _secret_name: string; _value: string }
        Returns: undefined
      }
      admin_trigger_classifier: { Args: never; Returns: number }
      admin_trigger_dispatcher: { Args: never; Returns: number }
      admin_trigger_eval: { Args: never; Returns: number }
      admin_trigger_pipeline: { Args: never; Returns: Json }
      admin_update_cron_schedule: {
        Args: { _jobname: string; _schedule: string }
        Returns: undefined
      }
      archive_match: {
        Args: { _archive?: boolean; _id: string }
        Returns: undefined
      }
      cleanup_old_publications: { Args: never; Returns: undefined }
      create_monthly_partitions: {
        Args: { months_ahead?: number }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      ensure_my_profile: { Args: never; Returns: Json }
      export_my_data: { Args: never; Returns: Json }
      get_daily_metrics: {
        Args: never
        Returns: {
          day: string | null
          matches_real: number | null
          matches_total: number | null
          notifications_dlq: number | null
          notifications_sent: number | null
          notifications_total: number | null
          publications_count: number | null
          scrape_runs_failed: number | null
          scrape_runs_success: number | null
          scrape_runs_total: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_metrics"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_runtime_status: {
        Args: never
        Returns: {
          cron_enabled: boolean
          functions_url: string
          key_set: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_match_flagged: {
        Args: { _flag: boolean; _id: string }
        Returns: undefined
      }
      mark_match_read: {
        Args: { _id: string; _read?: boolean }
        Returns: undefined
      }
      search_publications: {
        Args: {
          _limit?: number
          _offset?: number
          _q: string
          _since?: string
          _source_ids?: string[]
          _until?: string
        }
        Returns: {
          excerpt: string
          id: string
          publication_date: string
          similarity: number
          source_name: string
          source_uf: string
          title: string
          total_count: number
          url: string
        }[]
      }
      set_match_note: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      set_my_onboarding: {
        Args: { _state?: Json; _status?: string; _step?: number }
        Returns: undefined
      }
      set_runtime_config: {
        Args: {
          _cron_enabled: boolean
          _functions_url: string
          _service_role_key: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "user" | "admin"
      match_category:
        | "licitacao"
        | "nomeacao"
        | "exoneracao"
        | "processo"
        | "multa"
        | "homologacao"
        | "outro"
      match_type: "literal" | "regex" | "cnpj"
      notification_channel: "whatsapp" | "email"
      notification_status: "queued" | "sent" | "failed" | "dlq"
      scrape_status: "pending" | "running" | "success" | "failed"
      source_level: "federal" | "state" | "municipal"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["user", "admin"],
      match_category: [
        "licitacao",
        "nomeacao",
        "exoneracao",
        "processo",
        "multa",
        "homologacao",
        "outro",
      ],
      match_type: ["literal", "regex", "cnpj"],
      notification_channel: ["whatsapp", "email"],
      notification_status: ["queued", "sent", "failed", "dlq"],
      scrape_status: ["pending", "running", "success", "failed"],
      source_level: ["federal", "state", "municipal"],
    },
  },
} as const
