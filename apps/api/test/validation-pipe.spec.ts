import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';

class TestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });

  it('should accept valid declared payload without unexpected fields', async () => {
    const validData = { name: 'FlowPulse API' };
    const result = await pipe.transform(validData, {
      type: 'body',
      metatype: TestDto,
    });
    expect(result).toEqual(validData);
  });

  it('should reject unexpected non-whitelisted fields with 422 Unprocessable Entity', async () => {
    const invalidData = {
      name: 'FlowPulse API',
      extra_unexpected_field: 'malicious or unexpected',
    };

    try {
      await pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      });
      fail('ValidationPipe should have thrown an exception');
    } catch (err: unknown) {
      const error = err as {
        getStatus: () => HttpStatus;
        getResponse: () => { message: string[] };
      };
      expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      const response = error.getResponse();
      expect(response.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('property extra_unexpected_field should not exist'),
        ]),
      );
    }
  });
});
