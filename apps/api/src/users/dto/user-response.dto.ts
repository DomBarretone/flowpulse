import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    example: 'e0a1c6a2-9387-4b77-83d4-8d94c1c9e801',
    description: 'Identificador único (UUID)',
  })
  id!: string;

  @ApiProperty({
    example: 'user_2test123456789',
    description: 'Identificador único do usuário no Clerk',
  })
  clerk_user_id!: string;

  @ApiProperty({ example: 'admin@flowpulse.io', description: 'Endereço de email do usuário' })
  email!: string;

  @ApiProperty({ example: 'Admin FlowPulse', description: 'Nome do usuário' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.ADMIN, description: 'Papel do usuário no sistema' })
  role!: Role;

  @ApiProperty({ example: '2026-09-27T21:00:00.000Z', description: 'Data de criação' })
  created_at!: Date;

  @ApiProperty({ example: '2026-09-27T21:00:00.000Z', description: 'Data da última atualização' })
  updated_at!: Date;
}
