import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Login, useLogin } from 'react-admin';
import { BrandMark } from '../layout/BrandMark';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      await login({ username: email.trim(), password });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed');
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 4 }}
    >
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <BrandMark size={40} fontSize={16} />
        </Box>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          Sign in to tsyvinda.com
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Administrator access
        </Typography>
      </Box>

      {errorMessage && (
        <Alert severity="error" role="alert">
          {errorMessage}
        </Alert>
      )}

      {/* Labels stay pinned: browser autofill sets the field without notifying
          React, so an auto-shrinking label would sit on top of the value. */}
      <TextField
        label="Email"
        type="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        required
        disabled={loading}
        autoComplete="email"
        slotProps={{ inputLabel: { shrink: true } }}
      />

      <TextField
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        required
        disabled={loading}
        autoComplete="current-password"
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end"
                  size="small"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        sx={{ position: 'relative', py: 1.25, mt: 1 }}
      >
        {loading ? <CircularProgress size={24} sx={{ position: 'absolute' }} /> : 'Sign in'}
      </Button>
    </Box>
  );
};

export const LoginPage: React.FC = () => (
  <Login
    sx={(theme) => ({
      // RA hardcodes a purple radial gradient and pins the card to the top
      // with `justify-content: flex-start` plus a 6em card margin.
      justifyContent: 'center',
      backgroundImage: 'none',
      backgroundColor: theme.palette.background.default,
      // The lock avatar is always rendered and cannot be disabled by prop.
      '& .RaLogin-avatar': { display: 'none' },
      '& .RaLogin-card': { marginTop: 0, width: '100%', maxWidth: 400, marginInline: 2 },
    })}
  >
    <LoginForm />
  </Login>
);
