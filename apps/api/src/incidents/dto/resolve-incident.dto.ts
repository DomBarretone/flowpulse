import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResolveIncidentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'resolution_notes deve ser uma string' })
  @IsNotEmpty({ message: 'resolution_notes é obrigatório' })
  @MinLength(10, {
    message: 'resolution_notes deve conter no mínimo 10 caracteres',
  })
  @MaxLength(2000, {
    message: 'resolution_notes deve conter no máximo 2000 caracteres',
  })
  resolution_notes!: string;
}
