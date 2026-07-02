import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttAclController } from './mqtt-acl.controller';

@Global()
@Module({
  controllers: [MqttAclController],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
