import { Global, Module } from '@nestjs/common';
import { FormulaCipherService } from './formula-cipher.service';

@Global()
@Module({
  providers: [FormulaCipherService],
  exports: [FormulaCipherService],
})
export class CryptoModule {}
