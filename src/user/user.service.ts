import { ForbiddenException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Role, User } from '@prisma/client';
import { genSaltSync, hashSync } from 'bcrypt';
import { JwtPayload } from '@auth/interfaces';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { convertToSecondsUtil } from '@common/utils';
import { UploadService } from '../upload/upload.service';
import { UploadDirEnum } from '../upload/types';

@Injectable()
export class UserService {
    constructor(
        private readonly prismaService: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly configService: ConfigService,
        private readonly uploadService: UploadService,
    ) {}

    async save(user: Partial<User>) {
        const hashedPassword = user?.password ? this.hashPassword(user.password) : null;
        const savedUser = await this.prismaService.user.upsert({
            where: {
                email: user.email,
            },
            update: {
                password: hashedPassword,
                roles: user.roles,
            },
            create: {
                email: user.email,
                roles: ['USER'],
                password: hashedPassword,
            },
        });
        await this.cacheManager.set(savedUser.id, savedUser);
        await this.cacheManager.set(savedUser.email, savedUser);
        return savedUser;
    }

    async findOne(idOrEmail: string, isReset = false) {
        if (isReset) {
            await this.cacheManager.del(idOrEmail);
        }
        const user = await this.cacheManager.get<User>(idOrEmail);
        if (!user) {
            const user = await this.prismaService.user.findFirst({
                where: {
                    OR: [{ id: idOrEmail }, { email: idOrEmail }],
                },
            });
            if (!user) {
                return null;
            }
            await this.cacheManager.set(idOrEmail, user, convertToSecondsUtil(this.configService.get('JWT_EXP')));
            return user;
        }
        return user;
    }

    async delete(id: string, user: JwtPayload) {
        console.log(user);
        if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
            throw new ForbiddenException();
        }
        await Promise.all([this.cacheManager.del(id), this.cacheManager.del(user.email)]);

        // Проверяем наличие связанных записей в таблице 'tokens'
        const tokens = await this.prismaService.token.findMany({ where: { userId: id } });

        if (tokens.length > 0) {
            // Обрабатываем связанные записи в 'tokens' (например, удаляем их)
            await this.prismaService.token.deleteMany({ where: { userId: id } });
        }

        // Удаляем пользователя
        return this.prismaService.user.delete({ where: { id }, select: { id: true } });
    }

    // async change(idOrEmail: string, body: any, img: Express.Multer.File) {
    //     const user = await this.prismaService.user.findFirst({
    //         where: {
    //             OR: [{id: idOrEmail}, {email: idOrEmail}],
    //         },
    //     });
    //     if (!user) {
    //         return {status: 404}; // Возвращаем статус 404, если пользователь не найден
    //     } else {
    //         await Promise.all([this.cacheManager.del(idOrEmail), this.cacheManager.del(user.email)]);
    //         const {password, repeatPassword, ...rest} = body;
    //         if (password && repeatPassword) {
    //             if (password !== repeatPassword) {
    //                 return {status: 401, message: 'Пароли не совпадают'};
    //             }
    //             if (img) {
    //                 const newImg = await this.uploadService.filterFile(img)
    //
    //                 const updatedUser = await this.prismaService.user.update({
    //                     where: {id: user.id}, // Обновляем пользователя по его идентификатору
    //                     data: {
    //                         ...rest, // Обновляем остальные поля пользователя
    //                         password, // Обновляем пароль
    //                         img: await this.uploadService.saveFile(newImg, UploadDirEnum.USER)
    //                     },
    //                 });
    //                 await this.cacheManager.set(
    //                     idOrEmail,
    //                     updatedUser,
    //                     convertToSecondsUtil(this.configService.get('JWT_EXP')),
    //                 );
    //             } else {
    //                 const updatedUser = await this.prismaService.user.update({
    //                     where: {id: user.id}, // Обновляем пользователя по его идентификатору
    //                     data: {
    //                         ...rest, // Обновляем остальные поля пользователя
    //                         password, // Обновляем пароль
    //                     },
    //                 });
    //                 await this.cacheManager.set(
    //                     idOrEmail,
    //                     updatedUser,
    //                     convertToSecondsUtil(this.configService.get('JWT_EXP')),
    //                 );
    //             }
    //         } else {
    //             if (img) {
    //                 const newImg = await this.uploadService.filterFile(img)
    //                 const updatedUser = await this.prismaService.user.update({
    //                     where: {id: user.id}, // Обновляем пользователя по его идентификатору
    //                     data: {
    //                         ...rest, // Обновляем остальные поля пользователя
    //                         img: await this.uploadService.saveFile(newImg, UploadDirEnum.USER)
    //                     },
    //                 });
    //                 await this.cacheManager.set(
    //                     idOrEmail,
    //                     updatedUser,
    //                     convertToSecondsUtil(this.configService.get('JWT_EXP')),
    //                 );
    //             }
    //         }
    //         return {status: 200};
    //     }
    // }
    async change(idOrEmail: string, body: any, img: Express.Multer.File) {
        const user = await this.prismaService.user.findFirst({
            where: {
                OR: [{ id: idOrEmail }, { email: idOrEmail }],
            },
        });

        if (!user) {
            return { status: HttpStatus.NOT_FOUND };
        }

        await Promise.all([this.cacheManager.del(idOrEmail), this.cacheManager.del(user.email)]);
        const { password, repeatPassword, ...userData } = body;

        if (password && repeatPassword && password !== repeatPassword) {
            return { status: HttpStatus.UNAUTHORIZED, message: 'Пароли не совпадают' };
        }

        const updateData: any = { ...userData };

        if (password) {
            updateData.password = password;
        }

        if (img) {
            if (user.img) {
                await this.uploadService.removeFile(user.img, UploadDirEnum.USER);
            }
            const filteredImg = await this.uploadService.filterFile(img);
            const newImg = await this.uploadService.saveFile(filteredImg, UploadDirEnum.USER);
            updateData.img = newImg.name;
        }

        const updatedUser = await this.prismaService.user.update({
            where: { id: user.id },
            data: updateData,
        });

        await this.cacheManager.set(idOrEmail, updatedUser, convertToSecondsUtil(this.configService.get('JWT_EXP')));

        return { status: HttpStatus.OK };
    }

    private hashPassword(password: string): string {
        return hashSync(password, genSaltSync(10));
    }
}
