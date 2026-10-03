import { Controller, Delete, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/auth.types';
import { Public } from '../auth/public.decorator';
import { RequiresFeature } from '../auth/roles.decorator';
import { OpenFormulasService } from './open-formulas.service';

@Controller()
export class OpenFormulasController {
  constructor(
    private readonly open: OpenFormulasService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Get('open-formulas')
  list() {
    return this.open.listPublic();
  }

  @Public()
  @Get('open-formulas/:token')
  async read(@Param('token') token: string, @Headers('authorization') authorization?: string) {
    return this.open.readPublic(token, await this.optionalUser(authorization));
  }

  @Post('open-formulas/:token/clone')
  @RequiresFeature('workbench')
  clone(@Req() req: { user: JwtPayload }, @Param('token') token: string) {
    return this.open.clone(req.user, token);
  }

  @Get('formulas/:id/publication')
  @RequiresFeature('workbench')
  status(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.open.statusForFormula(req.user, id);
  }

  @Post('formulas/:id/publication')
  @RequiresFeature('workbench')
  publish(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.open.publish(req.user, id);
  }

  @Delete('formulas/:id/publication')
  @RequiresFeature('workbench')
  withdraw(@Req() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.open.withdraw(req.user, id);
  }

  private async optionalUser(authorization?: string): Promise<JwtPayload | null> {
    if (!authorization?.toLowerCase().startsWith('bearer ')) return null;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(authorization.slice(7).trim());
      if (!payload?.sub || !payload.email) return null;
      return { sub: payload.sub, email: payload.email, org: payload.org };
    } catch {
      return null;
    }
  }
}
