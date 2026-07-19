import { Module } from '@nestjs/common'
import { UniformsController } from './uniforms.controller'
import { UniformsService } from './uniforms.service'
import { ApprovalsModule } from '../approvals/approvals.module'

@Module({
  imports: [ApprovalsModule],
  controllers: [UniformsController],
  providers: [UniformsService],
})
export class UniformsModule {}
