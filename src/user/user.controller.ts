import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { UserService } from '@user/user.service';
import { UserResponseDto } from '@user/responses';
import { CurrentUser } from '@common/decorators';
import { JwtPayload } from '@auth/interfaces';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @UseInterceptors(ClassSerializerInterceptor)
    @Get(':idOrEmail')
    async findOneUser(@Param('idOrEmail') idOrEmail: string) {
        const user = await this.userService.findOne(idOrEmail);
        return new UserResponseDto(user);
    }

    @Delete(':id')
    async deleteUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.userService.delete(id, user);
    }

    @Get()
    me(@CurrentUser() user: JwtPayload) {
        return user;
    }

    @Patch(':idOrEmail')
    @UseInterceptors(FileInterceptor('img'))
    async changeUser(
        @UploadedFile() img: Express.Multer.File,
        @Param('idOrEmail') idOrEmail: string,
        @Body() body: any,
    ) {
        return this.userService.change(idOrEmail, body, img);
    }
}
