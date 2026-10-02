import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service.js';
import { OpenCashSessionDto } from './dto/open-cash-session.dto.js';
import { CloseCashSessionDto } from './dto/close-cash-session.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('cash-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CASHIER')
export class CashSessionsController {
  constructor(
    private readonly cashSessionsService: CashSessionsService,
  ) {}

  @Post('open')
  open(
    @Req() request: { user: { id: number } },
    @Body() dto: OpenCashSessionDto,
  ) {
    return this.cashSessionsService.open(
      request.user.id,
      dto,
    );
  }

  @Get('current')
  findCurrent(
    @Req() request: { user: { id: number } },
  ) {
    return this.cashSessionsService.findCurrent(
      request.user.id,
    );
  }

  @Post('close')
  close(
    @Req() request: { user: { id: number } },
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cashSessionsService.close(
      request.user.id,
      dto,
    );
  }
}
