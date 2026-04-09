import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { Public } from '../auth/decorators/public.decorator';

@Controller('user')
@Roles('admin')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id/invite-link')
  @Roles(RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN)
  getInviteLink(@Param('id') id: string) {
    return this.userService.getInviteLink(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Public()
  @Post('confirm/:token')
  confirmAccount(@Param('token') token: string) {
    return this.userService.confirmAccount(token);
  }

  @Public()
  @Get('confirm/:token')
  confirmAccountFromLink(@Param('token') token: string) {
    return this.userService.confirmAccount(token);
  }
}
