import { Module } from '@nestjs/common'
import { LeavesController } from './leaves.controller'
import { LeavesService } from './leaves.service'
import { ApprovalsModule } from '../approvals/approvals.module'

@Module({
  imports: [ApprovalsModule],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
