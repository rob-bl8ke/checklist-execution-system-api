import { Module } from '@nestjs/common';
import { AiProviderKey } from './enums/ai-provider-key.enum';
import { AiTargetType } from './enums/ai-target-type.enum';
import { ProviderCapabilitiesService } from './services/provider-capabilities.service';

export { AiProviderKey, AiTargetType };

@Module({
  imports: [],
  controllers: [],
  providers: [ProviderCapabilitiesService],
  exports: [ProviderCapabilitiesService],
})
export class AiModule {}
