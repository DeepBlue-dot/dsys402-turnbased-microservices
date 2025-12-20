export interface VerifyResult {
  valid: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    status: string;
    wins: number;
    losses: number;
    rating: number;
  };
}
