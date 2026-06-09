import { describe, it, expect } from 'vitest';
import { validateSync } from 'class-validator';
import { IsMatch } from './is-match.validator';

class ResetDto {
  password!: string;

  @IsMatch('password', { message: 'passwords do not match' })
  confirmPassword!: string;

  constructor(password: string, confirmPassword: string) {
    this.password = password;
    this.confirmPassword = confirmPassword;
  }
}

describe('IsMatch', () => {
  it('passes when the fields match', () => {
    const errors = validateSync(new ResetDto('secret123', 'secret123'));
    expect(errors).toHaveLength(0);
  });

  it('fails with the custom message when they differ', () => {
    const errors = validateSync(new ResetDto('secret123', 'nope'));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints?.isMatch).toBe('passwords do not match');
  });
});
