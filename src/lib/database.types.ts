// Hand-maintained to match supabase/migrations. Regenerate with
// `supabase gen types typescript --linked > src/lib/database.types.ts` once a project is linked.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OpportunityStage = "open" | "won" | "lost";
export type UsageKind = "import" | "draft";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; owner_user_id: string; created_at: string };
        Insert: { id?: string; name: string; owner_user_id: string; created_at?: string };
        Update: { id?: string; name?: string; owner_user_id?: string; created_at?: string };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          organization_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string;
          current_period_end: string | null;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: { id: string; organization_id: string; name: string; email: string; created_at: string };
        Insert: { id?: string; organization_id: string; name: string; email: string; created_at?: string };
        Update: { id?: string; organization_id?: string; name?: string; email?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          id: string;
          organization_id: string;
          contact_id: string | null;
          title: string;
          amount_cents: number;
          currency: string;
          stage: OpportunityStage;
          last_activity_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          contact_id?: string | null;
          title: string;
          amount_cents?: number;
          currency?: string;
          stage?: OpportunityStage;
          last_activity_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          contact_id?: string | null;
          title?: string;
          amount_cents?: number;
          currency?: string;
          stage?: OpportunityStage;
          last_activity_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      drafts: {
        Row: { id: string; organization_id: string; opportunity_id: string; content: string; created_at: string };
        Insert: { id?: string; organization_id: string; opportunity_id: string; content: string; created_at?: string };
        Update: { id?: string; organization_id?: string; opportunity_id?: string; content?: string; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "drafts_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events: {
        Row: { stripe_event_id: string; type: string; processed_at: string };
        Insert: { stripe_event_id: string; type: string; processed_at?: string };
        Update: { stripe_event_id?: string; type?: string; processed_at?: string };
        Relationships: [];
      };
      usage_events: {
        Row: { id: number; organization_id: string; kind: UsageKind; created_at: string };
        Insert: { id?: never; organization_id: string; kind: UsageKind; created_at?: string };
        Update: { id?: never; organization_id?: string; kind?: UsageKind; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_org_owner: { Args: { org_id: string }; Returns: boolean };
      has_entitlement: { Args: { org_id: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Organization = Tables<"organizations">;
export type Subscription = Tables<"subscriptions">;
export type Contact = Tables<"contacts">;
export type Opportunity = Tables<"opportunities">;
export type Draft = Tables<"drafts">;
