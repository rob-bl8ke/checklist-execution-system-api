import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getToday(
    @Query('upcomingDays', new DefaultValuePipe(7), ParseIntPipe)
    upcomingDays: number,
  ) {
    return this.dashboardService.getToday(upcomingDays);
  }
}
