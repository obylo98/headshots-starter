export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      credits: {
        Row: {
          created_at: string
          credits: number
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      generation_requests: {
        Row: {
          created_at: string
          endpoint: string
          error: string | null
          id: number
          model_id: number
          num_images: number
          request_id: string
          status: string
          style: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          error?: string | null
          id?: number
          model_id: number
          num_images?: number
          request_id: string
          status?: string
          style?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: number
          model_id?: number
          num_images?: number
          request_id?: string
          status?: string
          style?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_requests_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
      images: {
        Row: {
          created_at: string
          id: number
          modelId: number
          uri: string
        }
        Insert: {
          created_at?: string
          id?: number
          modelId: number
          uri: string
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: number
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "images_modelId_fkey"
            columns: ["modelId"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
      models: {
        Row: {
          ai_model: string | null
          created_at: string
          credits_used: number
          error: string | null
          id: number
          modelId: string | null
          name: string | null
          outfit: Json | null
          status: string
          styles: string[]
          type: string | null
          user_id: string | null
        }
        Insert: {
          ai_model?: string | null
          created_at?: string
          credits_used?: number
          error?: string | null
          id?: number
          modelId?: string | null
          name?: string | null
          outfit?: Json | null
          status?: string
          styles?: string[]
          type?: string | null
          user_id?: string | null
        }
        Update: {
          ai_model?: string | null
          created_at?: string
          credits_used?: number
          error?: string | null
          id?: number
          modelId?: string | null
          name?: string | null
          outfit?: Json | null
          status?: string
          styles?: string[]
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      samples: {
        Row: {
          created_at: string
          id: number
          modelId: number
          uri: string
        }
        Insert: {
          created_at?: string
          id?: number
          modelId: number
          uri: string
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: number
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "samples_modelId_fkey"
            columns: ["modelId"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: { p_user_id: string; p_amount: number }
        Returns: number
      }
      deduct_credits: {
        Args: { p_user_id: string; p_amount: number }
        Returns: number | null
      }
      grant_payment_credits: {
        Args: {
          p_user_id: string
          p_provider: string
          p_reference: string
          p_amount: number
          p_currency: string
          p_credits: number
          p_pack_id?: string | null
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
