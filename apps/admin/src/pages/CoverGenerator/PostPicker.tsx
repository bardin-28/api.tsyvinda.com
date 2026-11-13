import React, { useEffect, useState } from 'react';
import { useGetList } from 'react-admin';
import { Autocomplete, TextField } from '@mui/material';
import type { Post } from '@tsyvinda/shared-types';

const SEARCH_DEBOUNCE_MS = 300;
const PICKER_PAGE_SIZE = 25;

interface PostPickerProps {
  value: Post | null;
  onChange: (post: Post | null) => void;
}

/** Post autocomplete backed by the API's title/slug search (`q`). */
export const PostPicker: React.FC<PostPickerProps> = ({ value, onChange }) => {
  const [inputText, setInputText] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearchTerm(inputText.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [inputText]);

  // Typing the selected post's own title must not narrow the list to that one post.
  const query = value && searchTerm === value.title ? '' : searchTerm;
  const { data: posts = [], isPending } = useGetList<Post>('posts', {
    pagination: { page: 1, perPage: PICKER_PAGE_SIZE },
    sort: { field: 'createdAt', order: 'DESC' },
    filter: query ? { q: query } : {},
  });

  return (
    <Autocomplete<Post>
      options={posts}
      value={value}
      onChange={(_event, post) => onChange(post)}
      inputValue={inputText}
      onInputChange={(_event, text) => setInputText(text)}
      getOptionLabel={(post) => post.title}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      // Options come from the server search; do not filter them again client-side.
      filterOptions={(options) => options}
      loading={isPending}
      noOptionsText="No posts found"
      renderInput={(params) => (
        <TextField {...params} label="Post" placeholder="Search title or slug" margin="none" />
      )}
    />
  );
};
