/**
 * Test double for IFacebookPublishClient (spec 139: relocated out of the
 * production `src/fb-client.ts` module — the shipped worker bundle must not
 * contain test doubles). Records every publish call and returns configurable
 * mock ids / errors / telemetry for publisher and pipeline tests.
 */
import type {
  GraphRateLimitTelemetry,
  IFacebookPublishClient,
  PublishResult,
} from '@fbuploadpro/contracts';

export class MockFacebookPublishClient implements IFacebookPublishClient {
  public reelsPublished: Array<{
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }> = [];

  public photosPublished: Array<{
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }> = [];

  public textPostsPublished: Array<{
    pageId: string;
    message: string;
    linkUrl?: string | null | undefined;
  }> = [];

  public videosPublished: Array<{
    pageId: string;
    videoUrl: string;
    caption: string;
    title?: string | undefined;
  }> = [];

  public photoStoriesPublished: Array<{
    pageId: string;
    imageUrl: string;
  }> = [];

  public videoStoriesPublished: Array<{
    pageId: string;
    videoUrl: string;
  }> = [];

  public commentsPosted: Array<{
    postId: string;
    accessToken: string;
    message: string;
  }> = [];

  public nextPostId = 'mock_post_123';
  public nextCommentId = 'mock_comment_456';
  public errorToThrow: Error | null = null;
  public commentErrorToThrow: Error | null = null;
  public telemetryToReturn?: GraphRateLimitTelemetry | undefined;

  publishReel(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.reelsPublished.push(params);
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishPhoto(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.photosPublished.push(params);
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishTextPost(params: {
    pageId: string;
    accessToken: string;
    message: string;
    linkUrl?: string | null | undefined;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.textPostsPublished.push({
      pageId: params.pageId,
      message: params.message,
      ...(params.linkUrl !== undefined ? { linkUrl: params.linkUrl } : {}),
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishVideo(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
    title?: string | undefined;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.videosPublished.push({
      pageId: params.pageId,
      videoUrl: params.videoUrl,
      caption: params.caption,
      ...(params.title !== undefined ? { title: params.title } : {}),
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishPhotoStory(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.photoStoriesPublished.push({
      pageId: params.pageId,
      imageUrl: params.imageUrl,
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishVideoStory(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.videoStoriesPublished.push({
      pageId: params.pageId,
      videoUrl: params.videoUrl,
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  postComment(params: {
    postId: string;
    accessToken: string;
    message: string;
  }): Promise<{ commentId: string; telemetry?: GraphRateLimitTelemetry | undefined }> {
    if (this.commentErrorToThrow) {
      return Promise.reject(this.commentErrorToThrow);
    }
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.commentsPosted.push(params);
    return Promise.resolve({
      commentId: this.nextCommentId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  reset(): void {
    this.reelsPublished = [];
    this.photosPublished = [];
    this.textPostsPublished = [];
    this.videosPublished = [];
    this.photoStoriesPublished = [];
    this.videoStoriesPublished = [];
    this.commentsPosted = [];
    this.errorToThrow = null;
    this.commentErrorToThrow = null;
    this.telemetryToReturn = undefined;
  }
}
