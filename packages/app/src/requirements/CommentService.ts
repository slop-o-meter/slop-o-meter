export interface CommentContext {
  repoOwner: string;
  repoName: string;
  readmeExcerpt: string;
  currentScore: number;
}

export interface CommentService {
  generateComment(context: CommentContext): Promise<string>;
}
