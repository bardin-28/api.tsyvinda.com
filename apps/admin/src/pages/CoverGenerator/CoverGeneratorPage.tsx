import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Confirm, Title, useGetOne, useNotify, useUpdate } from 'react-admin';
import { Avatar, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { Download, Image as ImageIcon, OpenInNew, Restore, TextFields } from '@mui/icons-material';
import type { Post } from '@tsyvinda/shared-types';
import { CoverComposer, type CoverComposerHandle } from './CoverComposer';
import { CoverControls, type CoverFieldChange } from './CoverControls';
import { PostPicker } from './PostPicker';
import {
  COVER_POST_ID_PARAM,
  DEFAULT_COVER,
  coverFileName,
  getSizePreset,
  type CoverState,
} from './coverConfig';

/** Cover text taken from a post: title, and its description as the subtitle when it has one. */
export function coverTextFromPost(
  post: Pick<Post, 'title' | 'description'>,
  previous: CoverState,
): CoverState {
  const description = post.description?.trim() ?? '';
  return {
    ...previous,
    title: post.title,
    subtitle: description || previous.subtitle,
    showSubtitle: description ? true : previous.showSubtitle,
  };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export const CoverGeneratorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPostId = searchParams.get(COVER_POST_ID_PARAM);
  const [coverState, setCoverState] = useState<CoverState>(DEFAULT_COVER);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState<boolean>(false);
  const composerRef = useRef<CoverComposerHandle | null>(null);
  const notify = useNotify();
  // Untyped record: the payload is `{ image }` (a write-only upload field), not a Post field.
  const [updatePost, { isPending: isUploading }] = useUpdate();

  // Opened as /blog/cover?postId=…: select that post and take its text once.
  const { data: initialPost } = useGetOne<Post>(
    'posts',
    { id: initialPostId ?? '' },
    { enabled: !!initialPostId },
  );
  const hasPrefilledRef = useRef<boolean>(false);
  useEffect(() => {
    if (!initialPost || hasPrefilledRef.current) return;
    hasPrefilledRef.current = true;
    setSelectedPost(initialPost);
    setCoverState((previous) => coverTextFromPost(initialPost, previous));
  }, [initialPost]);

  const handleFieldChange = useCallback<CoverFieldChange>((key, value) => {
    setCoverState((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handleDownload = async () => {
    const composer = composerRef.current;
    if (!composer) return;
    setIsDownloading(true);
    try {
      downloadBlob(await composer.toJpegBlob(), coverFileName(coverState.title));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create the JPEG', {
        type: 'error',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const uploadCover = async () => {
    setIsReplaceConfirmOpen(false);
    const composer = composerRef.current;
    if (!composer || !selectedPost) return;
    try {
      const blob = await composer.toJpegBlob();
      const file = new File([blob], coverFileName(coverState.title), { type: 'image/jpeg' });
      // `{ rawFile }` makes the dataProvider send multipart `image`, like the post form does.
      const updatedPost = (await updatePost(
        'posts',
        { id: selectedPost.id, data: { image: { rawFile: file } }, previousData: selectedPost },
        { mutationMode: 'pessimistic', returnPromise: true },
      )) as Post;
      setSelectedPost(updatedPost);
      notify(`Cover set on “${selectedPost.title}”`, { type: 'success' });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not upload the cover', {
        type: 'error',
      });
    }
  };

  // The API deletes the old image when a new one arrives, so replacing asks first.
  const handleSetAsPostCover = () => {
    if (selectedPost?.imageUrl) setIsReplaceConfirmOpen(true);
    else void uploadCover();
  };

  const outputSize = getSizePreset(coverState.sizeId);

  return (
    <Box sx={{ mt: 2 }}>
      <Title title="Cover generator" />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          Cover generator
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Compose a branded blog cover, then download it or set it as a post&apos;s cover image.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Box>
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                Preview
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {outputSize.width} × {outputSize.height}
              </Typography>
            </Stack>
            <CoverComposer ref={composerRef} state={coverState} />
          </Box>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h4" component="h2">
                  Blog post
                </Typography>
                <PostPicker value={selectedPost} onChange={setSelectedPost} />
                {selectedPost && (
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Avatar
                      variant="rounded"
                      src={selectedPost.imageUrl ?? undefined}
                      alt=""
                      sx={{ width: 72, height: 38 }}
                    >
                      <ImageIcon fontSize="small" />
                    </Avatar>
                    <Chip
                      size="small"
                      label={selectedPost.imageUrl ? 'Has a cover' : 'No cover yet'}
                      color={selectedPost.imageUrl ? 'success' : 'default'}
                    />
                    <Button
                      component={Link}
                      to={`/posts/${selectedPost.id}`}
                      size="small"
                      endIcon={<OpenInNew fontSize="small" />}
                    >
                      Open post
                    </Button>
                  </Stack>
                )}
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1.5 }}>
                  <Button
                    variant="outlined"
                    startIcon={<TextFields />}
                    disabled={!selectedPost}
                    onClick={() =>
                      selectedPost &&
                      setCoverState((previous) => coverTextFromPost(selectedPost, previous))
                    }
                  >
                    Fill text from post
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<ImageIcon />}
                    disabled={!selectedPost || isUploading}
                    loading={isUploading}
                    onClick={handleSetAsPostCover}
                  >
                    Set as post cover
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack spacing={2}>
          <CoverControls state={coverState} onChange={handleFieldChange} />
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<Restore />}
              onClick={() => setCoverState(DEFAULT_COVER)}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              loading={isDownloading}
              onClick={() => void handleDownload()}
            >
              Download JPEG
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Confirm
        isOpen={isReplaceConfirmOpen}
        title="Replace the post cover?"
        content={`“${selectedPost?.title ?? ''}” already has a cover. It will be replaced and the old image deleted.`}
        confirm="Replace"
        onConfirm={() => void uploadCover()}
        onClose={() => setIsReplaceConfirmOpen(false)}
      />
    </Box>
  );
};
