import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

  it('returns parsed value', () => {
    expect(pipe.transform({ name: 'ok' })).toEqual({ name: 'ok' });
  });

  it('throws BadRequestException on invalid', () => {
    expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
  });
});
