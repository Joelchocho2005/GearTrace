import { Module, forwardRef } from '@nestjs/common';
import { LedGateway } from './led.gateway';
import { LedControllerService } from './led-controller.service';
import { AlexaModule } from '../alexa/alexa.module';

@Module({
  imports: [forwardRef(() => AlexaModule)],
  providers: [LedGateway, LedControllerService],
  exports: [LedGateway, LedControllerService],
})
export class LedModule {}
