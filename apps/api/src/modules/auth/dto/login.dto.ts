import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

export class LoginDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  email!: string

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  @MaxLength(100)
  password!: string
}
