import { Module } from '@nestjs/common'
import { RotationsController } from './rotations.controller'
import { RotationsService } from './rotations.service'

@Module({
  controllers: [RotationsController],
  providers: [RotationsService],
})
export class RotationsModule {}
