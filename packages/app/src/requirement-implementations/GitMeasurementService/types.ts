export default interface Commit {
  hash: string;
  week: string;
  timestamp: string;
  author: string;
  subject: string;
  additions: number;
  deletions: number;
  fileStats: FileStat[];
  coAuthors: string[];
  subCommitCount: number;
}

export interface FileStat {
  filePath: string;
  additions: number;
  deletions: number;
}
