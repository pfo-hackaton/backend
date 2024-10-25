import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { UploadDirEnum } from './types';
import { MFile } from './mfile.class';
import { join } from 'path';
import { access, mkdir, writeFile, rm } from 'fs/promises';

@Injectable()
export class UploadService {
    async saveFile(file: MFile, type: UploadDirEnum) {
        const uploadFolder = join(__dirname, '..', 'upload', type);

        try {
            await access(uploadFolder);
        } catch (e) {
            await mkdir(uploadFolder, { recursive: true });
        }
        try {
            await writeFile(join(uploadFolder, file.originalname), file.buffer);
        } catch (e) {
            throw new InternalServerErrorException('Ошибка при записи файла');
        }
        return {
            url: `/upload/${type}/${file.originalname}`,
            name: file.originalname,
        };
    }

    async removeFile(name: string, type: UploadDirEnum) {
        const uploadFolder = join(__dirname, '..', 'upload', type);
        await rm(join(uploadFolder, name));
    }

    async filterFile(file: MFile) {
        const mimetype = file.mimetype;
        const newName = uuidv4();
        const type = file.originalname.split('.')[1];

        return new MFile({
            buffer: file.buffer,
            originalname: `${newName}.${type}`,
            mimetype,
        });
    }
}
