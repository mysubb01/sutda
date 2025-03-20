export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          created_at: string;
          status: 'waiting' | 'playing' | 'finished';
          current_turn: string | null;
          betting_value: number;
          winner: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          status?: 'waiting' | 'playing' | 'finished';
          current_turn?: string | null;
          betting_value?: number;
          winner?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          status?: 'waiting' | 'playing' | 'finished';
          current_turn?: string | null;
          betting_value?: number;
          winner?: string | null;
        };
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          username: string;
          cards: number[];
          is_die: boolean;
          balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          username: string;
          cards?: number[];
          is_die?: boolean;
          balance?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          user_id?: string;
          username?: string;
          cards?: number[];
          is_die?: boolean;
          balance?: number;
          created_at?: string;
        };
      };
      game_actions: {
        Row: {
          id: string;
          game_id: string;
          player_id: string;
          action_type: 'join' | 'bet' | 'call' | 'die' | 'check';
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id: string;
          action_type: 'join' | 'bet' | 'call' | 'die' | 'check';
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          player_id?: string;
          action_type?: 'join' | 'bet' | 'call' | 'die' | 'check';
          amount?: number;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          username: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          username: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          user_id?: string;
          username?: string;
          content?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
} 