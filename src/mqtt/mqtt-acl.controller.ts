import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';

interface HiveMQAuthRequest {
  clientid: string;
  username: string;
  password: string;
}

interface HiveMQAclRequest {
  clientid: string;
  username: string; 
  topic: string;
  action: 'publish' | 'subscribe';
}

type AclResult = { result: 'allow' | 'deny' };

@ApiExcludeController()
@Controller('mqtt')
export class MqttAclController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('auth')
  @HttpCode(200)
  async authenticate(@Body() body: HiveMQAuthRequest): Promise<AclResult> {
    try {
      const decoded = await this.jwtService.verifyAsync(body.username);
      if (!decoded?.id) return { result: 'deny' };
      return { result: 'allow' };
    } catch {
      return { result: 'deny' };
    }
  }


  @Post('acl')
  @HttpCode(200)
  async authorize(@Body() body: HiveMQAclRequest): Promise<AclResult> {
    try {
      // Riders are only producers — deny all subscriptions from rider clients.
      if (body.action === 'subscribe') return { result: 'deny' };

      const segments = body.topic.split('/');
      if (
        segments.length !== 4 ||
        segments[0] !== 'riders' ||
        segments[3] !== 'location'
      ) {
        return { result: 'deny' };
      }

      const [, topicBusinessId, topicRiderId] = segments;

      const decoded = await this.jwtService.verifyAsync(body.username);
      if (!decoded?.riderId || !decoded?.businessId) return { result: 'deny' };

      if (decoded.riderId !== topicRiderId) return { result: 'deny' };
      if (decoded.businessId !== topicBusinessId) return { result: 'deny' };

      return { result: 'allow' };
    } catch {
      return { result: 'deny' };
    }
  }
}
