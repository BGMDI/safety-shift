import { IsEmail, IsString, MinLength } from 'class-validator'

export class PlatformLoginDto {
  @IsEmail() email!: string
  @IsString() @MinLength(8) password!: string
}

export class PlatformBootstrapDto {
  @IsEmail() email!: string
  @IsString() @MinLength(8) password!: string
  @IsString() fullName!: string
}
