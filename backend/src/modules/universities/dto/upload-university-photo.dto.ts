import { IsNotEmpty, IsString } from 'class-validator';

export class UploadUniversityPhotoDto {
  @IsString()
  @IsNotEmpty()
  imageBase64!: string;
}
