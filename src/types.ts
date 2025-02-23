export interface Author {
  name: string;
  hidden: boolean;
  user?: {
    avatarUrl: string;
    fullname: string;
    user: string;
  };
}

export interface Paper {
  paper: {
    id: string;
    authors: Author[];
    publishedAt: string;
    title: string;
    summary: string;
    upvotes: number;
    discussionId: string;
  };
  publishedAt: string;
  title: string;
  thumbnail: string;
  numComments: number;
  submittedBy: {
    avatarUrl: string;
    fullname: string;
    name: string;
  };
  isAuthorParticipating: boolean;
}