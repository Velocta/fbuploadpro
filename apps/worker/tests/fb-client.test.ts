import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  FacebookPublishClient,
  MockFacebookPublishClient,
  FacebookGraphError,
} from '../src/fb-client.js';

describe('FacebookPublishClient', () => {
  const pageId = 'page_12345';
  const accessToken = 'EAA_test_token_secret';
  const videoUrl = 'https://r2.example.com/videos/reel-1.mp4';
  const imageUrl = 'https://r2.example.com/images/photo-1.jpg';
  const caption = 'Check out this awesome video! #viral';
  const firstComment = 'Follow our page for daily updates!';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('publishReel (3-phase session)', () => {
    it('executes start, stream upload, and finish phases successfully', async () => {
      const mockFetch = vi.fn();

      // Phase 1: start upload session
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            video_id: 'vid_98765',
            upload_url: 'https://rupload.facebook.com/video-reels/vid_98765',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      // Phase 2: fetch video binary stream from videoUrl
      const fakeVideoBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('fake-binary-data'));
          controller.close();
        },
      });
      mockFetch.mockResolvedValueOnce(
        new Response(fakeVideoBody, {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        })
      );

      // Phase 2: upload binary stream to rupload
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Phase 3: finish upload and publish reel
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            post_id: `${pageId}_post_555`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      const result = await client.publishReel({
        pageId,
        accessToken,
        videoUrl,
        caption,
      });

      expect(result).toEqual({ postId: `${pageId}_post_555` });

      expect(mockFetch).toHaveBeenCalledTimes(4);

      // 1. Phase 1 call
      const [startUrl, startInit] = mockFetch.mock.calls[0];
      expect(startUrl).toBe(`https://graph.facebook.com/v26.0/${pageId}/video_reels`);
      expect(startInit.method).toBe('POST');
      expect(startInit.headers.Authorization).toBe(`Bearer ${accessToken}`);
      expect(JSON.parse(startInit.body)).toEqual({ upload_phase: 'start' });

      // 2. Fetch video binary
      const [fetchVideoUrl] = mockFetch.mock.calls[1];
      expect(fetchVideoUrl).toBe(videoUrl);

      // 3. Phase 2 call (upload stream)
      const [uploadUrl, uploadInit] = mockFetch.mock.calls[2];
      expect(uploadUrl).toBe('https://rupload.facebook.com/video-reels/vid_98765');
      expect(uploadInit.method).toBe('POST');
      expect(uploadInit.headers.Authorization).toBe(`OAuth ${accessToken}`);
      expect(uploadInit.headers.offset).toBe('0');
      expect(uploadInit.headers['Content-Type']).toBe('application/octet-stream');

      // 4. Phase 3 call (finish)
      const [finishUrl, finishInit] = mockFetch.mock.calls[3];
      expect(finishUrl).toBe(`https://graph.facebook.com/v26.0/${pageId}/video_reels`);
      expect(finishInit.method).toBe('POST');
      expect(finishInit.headers.Authorization).toBe(`Bearer ${accessToken}`);
      expect(JSON.parse(finishInit.body)).toEqual({
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: caption,
        video_id: 'vid_98765',
      });
    });

    it('falls back to video_id if post_id is not in finish response', async () => {
      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              video_id: 'vid_98765',
              upload_url: 'https://rupload.facebook.com/video-reels/vid_98765',
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response('video-data', { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      const result = await client.publishReel({ pageId, accessToken, videoUrl, caption });
      expect(result).toEqual({ postId: 'vid_98765' });
    });

    it('throws error when video source fetch fails in Phase 2', async () => {
      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              video_id: 'vid_98765',
              upload_url: 'https://rupload.facebook.com/video-reels/vid_98765',
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }));

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      await expect(
        client.publishReel({ pageId, accessToken, videoUrl, caption })
      ).rejects.toThrow(/Failed to fetch video/i);
    });
  });

  describe('publishPhoto', () => {
    it('executes photo upload POST to Graph API with published=true', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'photo_999',
            post_id: `${pageId}_photo_999`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      const result = await client.publishPhoto({
        pageId,
        accessToken,
        imageUrl,
        caption,
      });

      expect(result).toEqual({ postId: `${pageId}_photo_999` });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(`https://graph.facebook.com/v26.0/${pageId}/photos`);
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe(`Bearer ${accessToken}`);
      expect(JSON.parse(init.body)).toEqual({
        url: imageUrl,
        caption,
        published: true,
      });
    });

    it('falls back to id if post_id is not present in response', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'photo_only_id' }), { status: 200 })
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      const result = await client.publishPhoto({
        pageId,
        accessToken,
        imageUrl,
        caption,
      });

      expect(result).toEqual({ postId: 'photo_only_id' });
    });
  });

  describe('postComment', () => {
    it('posts first comment to Graph API comment endpoint', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'comment_abc123',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      const result = await client.postComment({
        postId: `${pageId}_post_555`,
        accessToken,
        message: firstComment,
      });

      expect(result).toEqual({ commentId: 'comment_abc123' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(`https://graph.facebook.com/v26.0/${pageId}_post_555/comments`);
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe(`Bearer ${accessToken}`);
      expect(JSON.parse(init.body)).toEqual({
        message: firstComment,
      });
    });
  });

  describe('Graph API error handling', () => {
    it('throws FacebookGraphError on invalid token (code 190)', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'Error validating access token: Session has expired.',
              type: 'OAuthException',
              code: 190,
              error_subcode: 463,
              fbtrace_id: 'abc_trace_190',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });

      let thrownError: unknown = null;
      try {
        await client.publishReel({ pageId, accessToken, videoUrl, caption });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(FacebookGraphError);
      const graphError = thrownError as FacebookGraphError;
      expect(graphError.code).toBe(190);
      expect(graphError.isAuthError).toBe(true);
      expect(graphError.isRateLimit).toBe(false);
      expect(graphError.fbtraceId).toBe('abc_trace_190');
      expect(graphError.message).toContain('Error validating access token');
    });

    it('throws FacebookGraphError on rate limit error (code 368)', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'It looks like you were misusing this feature by going too fast. You’ve been temporarily blocked from using it.',
              type: 'OAuthException',
              code: 368,
              fbtrace_id: 'abc_trace_368',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });

      let thrownError: unknown = null;
      try {
        await client.publishPhoto({ pageId, accessToken, imageUrl, caption });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(FacebookGraphError);
      const graphError = thrownError as FacebookGraphError;
      expect(graphError.code).toBe(368);
      expect(graphError.isRateLimit).toBe(true);
      expect(graphError.isAuthError).toBe(false);
    });

    it('throws FacebookGraphError on comment endpoint error', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'Unsupported post request. Object with ID does not exist.',
              type: 'GraphMethodException',
              code: 100,
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });

      await expect(
        client.postComment({ postId: 'invalid_id', accessToken, message: 'test' })
      ).rejects.toThrow(FacebookGraphError);
    });

    it('identifies rate limit codes 4, 17, 32, and 613', () => {
      for (const code of [4, 17, 32, 368, 613]) {
        const err = new FacebookGraphError('Rate limit exceeded', {
          message: 'Rate limit exceeded',
          code,
        });
        expect(err.isRateLimit).toBe(true);
        expect(err.isAuthError).toBe(false);
      }
    });

    it('throws error when start session response is missing video_id or upload_url', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      await expect(
        client.publishReel({ pageId, accessToken, videoUrl, caption })
      ).rejects.toThrow(/missing video_id or upload_url/i);
    });

    it('throws error when binary upload fails in Phase 2', async () => {
      const mockFetch = vi.fn();
      mockFetch
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              video_id: 'vid_123',
              upload_url: 'https://rupload.facebook.com/video-reels/vid_123',
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response('binary', { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: { message: 'Transfer aborted', code: 500 },
            }),
            { status: 500 }
          )
        );

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      await expect(
        client.publishReel({ pageId, accessToken, videoUrl, caption })
      ).rejects.toThrow(/Transfer aborted/i);
    });

    it('throws error when photo response is missing id or post_id', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      await expect(
        client.publishPhoto({ pageId, accessToken, imageUrl, caption })
      ).rejects.toThrow(/missing id\/post_id/i);
    });

    it('throws error when comment response is missing id', async () => {
      const mockFetch = vi.fn();
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

      const client = new FacebookPublishClient({ fetchFn: mockFetch });
      await expect(
        client.postComment({ postId: 'p1', accessToken, message: 'm1' })
      ).rejects.toThrow(/missing id/i);
    });

    it('trims trailing slashes from custom baseUrl', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'p123' }), { status: 200 })
      );

      const client = new FacebookPublishClient({
        baseUrl: 'https://custom-graph.facebook.com/v26.0/',
        fetchFn: mockFetch,
      });

      await client.publishPhoto({ pageId, accessToken, imageUrl, caption });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-graph.facebook.com/v26.0/page_12345/photos',
        expect.anything()
      );
    });
  });

  describe('MockFacebookPublishClient', () => {
    it('records published items and returns mock IDs', async () => {
      const mockClient = new MockFacebookPublishClient();

      const reelResult = await mockClient.publishReel({
        pageId,
        accessToken,
        videoUrl,
        caption,
      });
      expect(reelResult).toEqual({ postId: 'mock_post_123' });
      expect(mockClient.reelsPublished).toHaveLength(1);
      expect(mockClient.reelsPublished[0].pageId).toBe(pageId);

      const photoResult = await mockClient.publishPhoto({
        pageId,
        accessToken,
        imageUrl,
        caption,
      });
      expect(photoResult).toEqual({ postId: 'mock_post_123' });
      expect(mockClient.photosPublished).toHaveLength(1);

      const commentResult = await mockClient.postComment({
        postId: reelResult.postId,
        accessToken,
        message: firstComment,
      });
      expect(commentResult).toEqual({ commentId: 'mock_comment_456' });
      expect(mockClient.commentsPosted).toHaveLength(1);

      mockClient.reset();
      expect(mockClient.reelsPublished).toHaveLength(0);
      expect(mockClient.photosPublished).toHaveLength(0);
      expect(mockClient.commentsPosted).toHaveLength(0);
    });

    it('throws error when errorToThrow is configured', async () => {
      const mockClient = new MockFacebookPublishClient();
      mockClient.errorToThrow = new Error('Simulated Meta API failure');

      await expect(
        mockClient.publishReel({ pageId, accessToken, videoUrl, caption })
      ).rejects.toThrow('Simulated Meta API failure');

      await expect(
        mockClient.publishPhoto({ pageId, accessToken, imageUrl, caption })
      ).rejects.toThrow('Simulated Meta API failure');

      await expect(
        mockClient.postComment({ postId: 'p1', accessToken, message: 'm1' })
      ).rejects.toThrow('Simulated Meta API failure');
    });
  });
});
