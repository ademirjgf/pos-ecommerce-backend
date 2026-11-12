
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(
    @Req() request: {
      user: {
        id: number;
        email: string;
        role: string;
      };
    },
  ) {
    return request.user;
  }

  @ApiBearerAuth('access-token')
  @Post('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.authService.createStaff(dto);
  }
}
