import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AddressesService } from './addresses.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
  ) {}

  @Get()
  findAll(
    @Req() request: { user: { id: number } },
  ) {
    return this.addressesService.findAll(request.user.id);
  }

  @Post()
  create(
    @Req() request: { user: { id: number } },
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressesService.create(
      request.user.id,
      dto,
    );
  }
}
