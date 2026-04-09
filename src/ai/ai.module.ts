import { Module } from '@nestjs/common';
import { AiProviderKey } from './enums/ai-provider-key.enum';
import { AiTargetType } from './enums/ai-target-type.enum';

export { AiProviderKey, AiTargetType };

@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class AiModule {}
