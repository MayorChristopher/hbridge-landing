export type CommunityPostType = "suggestion" | "question" | "comment";

export type CommunityPost = {
  id: string;
  created_at: string;
  type: CommunityPostType;
  name: string | null;
  content: string;
  answer: string | null;
  answered_at: string | null;
  upvotes: number;
};

export const POST_TYPE_LABELS: Record<CommunityPostType, string> = {
  suggestion: "Suggestion",
  question: "Question",
  comment: "Comment",
};
