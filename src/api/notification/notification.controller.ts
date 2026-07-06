import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { NotificationService } from './notification.service';
import {
  RegisterDeviceTokenDTO,
  RemoveDeviceTokenDTO,
} from './dtos/device-token.dto';
import { UserType } from 'src/constants';
import { successResponse } from 'src/helpers/response.helper';

@Controller('notification')
@ApiTags('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('device-token')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Register or update a device token for push notifications (rider only)',
  })
  @ApiBody({ type: RegisterDeviceTokenDTO })
  async registerDeviceToken(
    @Auth() auth: ITokenPayload,
    @Body() payload: RegisterDeviceTokenDTO,
  ) {
    return await this.notificationService.registerDeviceToken(auth.id, payload);
  }

  @Delete('device-token')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deactivate a device token (logout from device push) (rider only)',
  })
  @ApiBody({ type: RemoveDeviceTokenDTO })
  async removeDeviceToken(
    @Auth() auth: ITokenPayload,
    @Body() payload: RemoveDeviceTokenDTO,
  ) {
    return await this.notificationService.removeDeviceToken(auth.id, payload);
  }

  @Get('inbox')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch in-app notifications for the authenticated user' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getInbox(
    @Auth() auth: ITokenPayload,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.notificationService.getInAppNotifications(
      auth.id,
      {
        unreadOnly: unreadOnly === 'true',
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
    );
    return successResponse(
      'Notifications fetched successfully',
      result.notifications,
      {
        meta: {
          count: result.count,
          totalPages: result.totalPages,
          currentPage: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 20,
        },
      },
    );
  }

  @Get('inbox/unread-count')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get count of unread in-app notifications' })
  async getUnreadCount(@Auth() auth: ITokenPayload) {
    const count = await this.notificationService.getUnreadCount(auth.id);
    return successResponse('Unread count fetched', { count });
  }

  @Patch('inbox/read-all')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all in-app notifications as read' })
  async markAllAsRead(@Auth() auth: ITokenPayload) {
    const updated = await this.notificationService.markAllNotificationsAsRead(
      auth.id,
    );
    return successResponse(`${updated} notification(s) marked as read`, {
      updated,
    });
  }

  @Patch('inbox/:id/read')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS, UserType.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a single in-app notification as read' })
  async markAsRead(@Auth() auth: ITokenPayload, @Param('id') id: string) {
    const updated = await this.notificationService.markNotificationAsRead(
      id,
      auth.id,
    );
    return successResponse(
      updated ? 'Notification marked as read' : 'Notification not found',
      { updated },
    );
  }
}
