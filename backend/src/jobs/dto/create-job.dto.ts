import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'type is required' })
  @MaxLength(100)
  type: string;
}