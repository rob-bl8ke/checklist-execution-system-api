import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { SendAiMessageDto } from './dto/send-ai-message.dto';
import { RunAiActionDto } from './dto/run-ai-action.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // ---------------------------------------------------------------------------
  // GET /api/ai/providers/status
  // ---------------------------------------------------------------------------

  @Get('providers/status')
  getProviderStatus() {
    return this.aiService.getProviderStatus();
  }

  // ---------------------------------------------------------------------------
  // GET /api/ai/targets/:targetType/:targetId/session
  // ---------------------------------------------------------------------------

  @Get('targets/:targetType/:targetId/session')
  getSession(
    @Param('targetType') targetType: string,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.aiService.getSession(targetType, targetId);
  }

  // ---------------------------------------------------------------------------
  // DELETE /api/ai/targets/:targetType/:targetId/session
  // ---------------------------------------------------------------------------

  @Delete('targets/:targetType/:targetId/session')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearSession(
    @Param('targetType') targetType: string,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.aiService.clearSession(targetType, targetId);
  }

  // ---------------------------------------------------------------------------
  // POST /api/ai/targets/:targetType/:targetId/messages
  // ---------------------------------------------------------------------------

  @Post('targets/:targetType/:targetId/messages')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @Param('targetType') targetType: string,
    @Param('targetId', ParseIntPipe) targetId: number,
    @Body() dto: SendAiMessageDto,
  ) {
    return this.aiService.sendMessage(targetType, targetId, dto);
  }

  // ---------------------------------------------------------------------------
  // POST /api/ai/targets/:targetType/:targetId/actions/:actionKey
  // ---------------------------------------------------------------------------

  @Post('targets/:targetType/:targetId/actions/:actionKey')
  @HttpCode(HttpStatus.CREATED)
  runAction(
    @Param('targetType') targetType: string,
    @Param('targetId', ParseIntPipe) targetId: number,
    @Param('actionKey') actionKey: string,
    @Body() dto: RunAiActionDto,
  ) {
    return this.aiService.runAction(targetType, targetId, actionKey, dto);
  }

  // ---------------------------------------------------------------------------
  // POST /api/ai/proposals/:proposalId/apply
  // ---------------------------------------------------------------------------

  @Post('proposals/:proposalId/apply')
  @HttpCode(HttpStatus.OK)
  applyProposal(@Param('proposalId', ParseIntPipe) proposalId: number) {
    return this.aiService.applyProposal(proposalId);
  }

  // ---------------------------------------------------------------------------
  // POST /api/ai/proposals/:proposalId/revert
  // ---------------------------------------------------------------------------

  @Post('proposals/:proposalId/revert')
  @HttpCode(HttpStatus.OK)
  revertProposal(@Param('proposalId', ParseIntPipe) proposalId: number) {
    return this.aiService.revertProposal(proposalId);
  }
}
