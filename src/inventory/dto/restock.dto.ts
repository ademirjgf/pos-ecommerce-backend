import { IsInt, Max, Min } from 'class-validator';

export class RestockDto {
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;
}