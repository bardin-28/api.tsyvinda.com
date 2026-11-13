import React from 'react';
import {
  DeleteButton,
  Edit,
  Form,
  SelectInput,
  required,
  useGetIdentity,
  useRecordContext,
} from 'react-admin';
import { Avatar, Box, Tooltip, Typography } from '@mui/material';
import { Person } from '@mui/icons-material';
import type { AdminUser } from '@tsyvinda/shared-types';
import { SingleImageInput } from '../../components/SingleImageInput';
import {
  DetailLayout,
  SaveCard,
  SidebarCard,
  SidebarFacts,
  detailDateFormat,
} from '../../components/DetailLayout';
import { ROLE_CHOICES, fullName } from './userDisplay';
import { toUserPayload, type UserFormValues } from './userPayload';

/** Why this user cannot be deleted, or null when they can (mirrors the API's 409 rules). */
export function deleteBlockedReason(user: AdminUser, signedInUserId?: string): string | null {
  if (user.id === signedInUserId) return 'You cannot delete your own account';
  if (user.postCount > 0) {
    return `Has ${user.postCount} post${user.postCount === 1 ? '' : 's'}; delete or reassign them first`;
  }
  return null;
}

const useIsSelf = (): boolean => {
  const user = useRecordContext<AdminUser>();
  const { identity } = useGetIdentity();
  return !!user && user.id === identity?.id;
};

/**
 * Round preview of the current or newly picked avatar. MUI's Avatar falls back to an icon when
 * the image fails to load (e.g. a stored URL whose object no longer exists).
 */
const AvatarPreview: React.FC = () => {
  const file = useRecordContext<{ src?: string }>();
  return (
    <Avatar src={file?.src} alt="Avatar preview" sx={{ width: 96, height: 96, m: 0.5 }}>
      <Person sx={{ fontSize: 48 }} />
    </Avatar>
  );
};

// Existing users carry the avatar as a URL string; ImageInput previews `{ src }`.
const formatAvatar = (value: unknown) => (typeof value === 'string' ? { src: value } : value);

/** Right column: Save and Delete (blocked for yourself / users with posts). */
const UserSidebar: React.FC = () => {
  const user = useRecordContext<AdminUser>();
  const { identity } = useGetIdentity();
  if (!user) return null;
  const blockedReason = deleteBlockedReason(user, identity?.id as string | undefined);

  return (
    <>
      <SaveCard note="Role changes apply on the user's next request." />
      <SidebarCard title="Delete" centered>
        {/* Tooltip needs a hoverable wrapper: disabled buttons emit no pointer events */}
        <Tooltip title={blockedReason ?? ''}>
          <span>
            <DeleteButton
              mutationMode="pessimistic"
              label="Delete user"
              confirmTitle={`Delete ${fullName(user)}?`}
              confirmContent="Their account, sessions and profile image are removed. This cannot be undone."
              disabled={!!blockedReason}
            />
          </span>
        </Tooltip>
        {blockedReason && (
          <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            {blockedReason}
          </Typography>
        )}
      </SidebarCard>
    </>
  );
};

/** Titled block inside the main card, separated from the previous one by a rule. */
const MainSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Box component="section" sx={{ pt: 2, mt: 1, borderTop: 1, borderColor: 'divider' }}>
    <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

/** Main block: who the user is, their avatar, account facts and role. */
const UserFields: React.FC = () => {
  const user = useRecordContext<AdminUser>();
  const isSelf = useIsSelf();
  if (!user) return null;

  return (
    <>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h3" component="h2">
          {fullName(user)}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {user.email}
        </Typography>
      </Box>

      <MainSection title="Avatar">
        <SingleImageInput
          source="profileImageUrl"
          accept={{ 'image/jpeg': [], 'image/png': [], 'image/webp': [] }}
          maxSize={5 * 1024 * 1024}
          format={formatAvatar}
          placeholder={
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
              Drop an image or click to upload
            </Typography>
          }
          helperText="JPEG, PNG or WebP, up to 5 MB"
          sx={{ maxWidth: 420, '& .RaFileInput-dropZone': { py: 1 } }}
        >
          <AvatarPreview />
        </SingleImageInput>
      </MainSection>

      <MainSection title="Account">
        <Box sx={{ maxWidth: 420 }}>
          <SidebarFacts
            facts={[
              ['Posts', user.postCount],
              ['Signed up', detailDateFormat.format(new Date(user.createdAt))],
            ]}
          />
        </Box>
      </MainSection>

      <MainSection title="Permissions">
        <SelectInput
          source="role"
          choices={ROLE_CHOICES}
          // Required also drops RA's empty "clear" option: a user always has a role
          validate={required()}
          disabled={isSelf}
          helperText={
            isSelf
              ? 'You cannot change your own role'
              : 'Admins can sign in to this panel. Takes effect on their next request.'
          }
          sx={{ maxWidth: 320, m: 0 }}
        />
      </MainSection>
    </>
  );
};

const UserTitle: React.FC = () => {
  const user = useRecordContext<AdminUser>();
  return <>{user ? `User “${fullName(user)}”` : 'User'}</>;
};

export const UserEdit: React.FC = () => (
  <Edit
    title={<UserTitle />}
    actions={false}
    // No Card wrapper: it clips (overflow: hidden) and would break the sticky sidebar
    component="div"
    mutationMode="pessimistic"
    transform={(values: UserFormValues, options?: { previousData?: AdminUser }) =>
      toUserPayload(values, options?.previousData)
    }
  >
    <Form>
      <DetailLayout sidebar={<UserSidebar />}>
        <UserFields />
      </DetailLayout>
    </Form>
  </Edit>
);
