export interface BlogFrontmatter {
  title: string;
  description: string;
  slug: string;
  titleTag: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  date: string;
  author: string;
  topic: string;
  draft: boolean;
  publish: boolean;
  featuredImage?: string;
}

export interface LinkedInPost {
  id: string;
  type: 'insight_post' | 'framework_post';
  content: string;
  hook_line: string;
  hashtags: string[];
  isEdited: boolean;
}

export interface CarouselSlide {
  id: string;
  slideNumber: number;
  type: 'hook' | 'content' | 'cta';
  headline: string;
  subhead?: string;
  hook?: string;
  url?: string;
  imageUrl?: string;
  isEdited: boolean;
}

export interface CarouselData {
  hook: string;
  slides: CarouselSlide[];
  cta_slide: {
    headline: string;
    url: string;
  };
}

export interface PipelineSession {
  id: string;
  createdAt: string;
  currentStep: number;
  status: 'in_progress' | 'completed' | 'failed';

  // Step 1: Topic
  topic: {
    source: 'queue' | 'custom';
    slug: string;
    title: string;
    outline?: string;
  };

  // Step 2: Blog
  blog: {
    frontmatter: Partial<BlogFrontmatter>;
    content: string;
    htmlContent: string;
    webflowId?: string;
    publishedUrl?: string;
    status: 'draft' | 'published';
  };

  // Step 3: LinkedIn
  linkedin: {
    posts: LinkedInPost[];
    carousel: Partial<CarouselData>;
    regenerationCount: number;
  };

  // Step 4: Carousel Images
  carousel: {
    slides: CarouselSlide[];
    imageUrls: string[];
    status: 'pending' | 'generating' | 'complete';
  };

  // Step 5: PDF
  pdf: {
    pdfUrl?: string;
    status: 'pending' | 'generated';
  };

  // Step 6: Export
  export: {
    sheetsExported: boolean;
    sheetUrl?: string;
    driveUploaded: boolean;
    driveUrl?: string;
  };

  // Step 7: Queue
  queue: {
    postsQueued: string[];
    status: 'pending' | 'queued';
  };
}

export interface ContentQueueItem {
  id: number;
  title: string;
  pillar: string;
  funnel: string;
  keyword: string;
  persona: string;
  priority: number;
  status: 'queued' | 'published';
  slug: string;
}
