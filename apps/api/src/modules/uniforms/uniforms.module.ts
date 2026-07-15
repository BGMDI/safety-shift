import { Module } from '@nestjs/common'
import { UniformsController } from './uniforms.controller'
import { UniformsService } from './uniforms.service'

@Module({
  controllers: [UniformsController],
  providers: [UniformsService],
})
export class UniformsModule {}
